/**
 * The four services a tenant fiber names, plus a tiny core surface so
 * `ctx.surfaces` has something to fuse onto.
 *
 * Each registration method returns a disposer attached to the CALLING fiber
 * (`ctx.effect`), which is the dsh shape: unload unregisters, and a throwing
 * `apply` that never reached `register` installed nothing.
 */

import { defineSurface, mergeDisjointGroups } from "@kolu/surface/define"
import {
  implementSurface,
  implementSurfaces,
  inMemoryStore,
  type SurfaceHandlers,
  type SurfaceMap,
} from "@kolu/surface/server"
import { Context, Service } from "cordis"
import { Schema } from "effect"

import type { Deliveries, PluginServices, PropKind } from "@olai/plugin-api/server"

export type RosterRow = {
  readonly name: string
  readonly running: boolean
}

/**
 * Spike-local roster. It is not the `plugins` cell: wiring that cell is
 * phase 2's composition root. `roster.test.ts` holds this value to
 * `@olai/surface`'s `PluginRoster` so a republish would decode.
 */
export type Roster = {
  readonly built: ReadonlyArray<RosterRow>
  readonly pinned: ReadonlyArray<string> | null
}

export type RegisteredSibling = {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly faces: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly deps: unknown
}

/** Stand-in for olai's own surface — one cell, enough to ask whether fusion
 *  moved a core tag. The real one is `@olai/surface` and this package does
 *  not import it: what is under test is the composition, not the spec. */
export const coreSurface = defineSurface({
  cells: { errors: { schema: Schema.String, default: "" } },
})

export const coreRuntime = () =>
  implementSurface(coreSurface, { cells: { errors: { store: inMemoryStore("") } } })

const emptyRoster = (): Roster => ({ built: [], pinned: null })

export class Vault extends Service {
  env: Record<string, string | undefined> = {}
  served = "/tmp/cordis-spike-vault"
  now = () => "1970-01-01T00:00:00.000Z"
  say = (_line: string) => {}
  warn = (_line: string) => {}

  constructor(ctx: Context) {
    super(ctx, "vault")
  }

  revision(snapshot: unknown) {
    this.ctx.emit("vault/revision", snapshot)
  }
}

export class DeliveriesService extends Service {
  constructor(ctx: Context) {
    super(ctx, "deliveries")
  }

  /** One write-only door, stamped with the calling fiber's name. */
  forFiber(name: string): Deliveries {
    return {
      scopes: () => [],
      deliver: () => {
        void name
      },
    }
  }
}

export class Kinds extends Service {
  readonly table = new Map<string, PropKind>()

  constructor(ctx: Context) {
    super(ctx, "kinds")
  }

  register(kind: PropKind) {
    return this.ctx.effect(() => {
      this.table.set(kind.kind, kind)
      return () => {
        this.table.delete(kind.kind)
      }
    })
  }
}

export class Surfaces extends Service {
  readonly siblings = new Map<string, RegisteredSibling>()
  readonly core = coreRuntime()
  roster: Roster = emptyRoster()
  fused: {
    group: ReturnType<typeof coreRuntime>["group"]
    handlers: SurfaceHandlers
  }
  /** Built names the roster still lists when a sibling is off — the
   *  preferences row per plugin this binary was built with. */
  builtNames: ReadonlyArray<string> = []

  constructor(ctx: Context) {
    super(ctx, "surfaces")
    this.fused = {
      group: this.core.group,
      handlers: { ...this.core.handlers },
    }
    this.publishRoster()
  }

  register(sibling: RegisteredSibling) {
    return this.ctx.effect(() => {
      this.siblings.set(sibling.name, sibling)
      this.recompose()
      return () => {
        this.siblings.delete(sibling.name)
        this.recompose()
      }
    })
  }

  /** Core's tags, sorted — the composition.test.ts claim, readable at any
   *  moment rather than only at boot. */
  coreTags(): ReadonlyArray<string> {
    return [...this.core.group.requests.keys()].sort()
  }

  fusedTags(): ReadonlyArray<string> {
    return [...this.fused.group.requests.keys()].sort()
  }

  /**
   * Re-calls `implementSurfaces` over EVERY remaining sibling. There is no
   * incremental add/drop on a live group — the same fact as `connectSurfaces`
   * baking the map at the call, seen from olai's side. State survives only
   * because it lives in each plugin's `deps`; a server holding the previous
   * `fused.handlers` keeps serving them. Phase 2 must not paper over this
   * with a spike-local re-compose: it is a framework ask beside the
   * `@kolu/surface` live-sibling one.
   */
  private recompose() {
    const surfaces = Object.fromEntries(
      [...this.siblings.values()].map((one) => [one.name, one.surface]),
    )
    const deps = Object.fromEntries(
      [...this.siblings.values()].map((one) => [one.name, one.deps]),
    )
    const bundle = implementSurfaces(
      surfaces as unknown as SurfaceMap,
      {},
      deps as never,
    )
    const group = mergeDisjointGroups({ core: this.core.group, plugins: bundle.group })
    const handlers: SurfaceHandlers = { ...this.core.handlers, ...bundle.handlers }
    this.fused = { group, handlers }
    this.publishRoster()
    this.ctx.emit("surfaces/published", this.roster)
  }

  private publishRoster() {
    const running = new Set(this.siblings.keys())
    const names = this.builtNames.length > 0 ? this.builtNames : [...running]
    this.roster = {
      built: names.map((name) => ({ name, running: running.has(name) })),
      pinned: running.size === names.length ? null : [...running].sort(),
    }
  }
}

declare module "cordis" {
  interface Context {
    vault: Vault
    deliveries: DeliveriesService
    kinds: Kinds
    surfaces: Surfaces
  }
  interface Events {
    "vault/revision"(snapshot: unknown): void
    "surfaces/published"(roster: Roster): void
  }
}

export const servicesOf = (ctx: Context, fiberName: string): PluginServices => ({
  env: ctx.vault.env,
  now: ctx.vault.now,
  served: ctx.vault.served,
  say: ctx.vault.say,
  warn: ctx.vault.warn,
  deliveries: ctx.deliveries.forFiber(fiberName),
})
