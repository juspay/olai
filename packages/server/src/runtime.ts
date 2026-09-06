/** The host composes scoped capability surfaces and publishes management.
 * Domain providers keep their own handlers, sources and compatibility tags.
 * A provider's disappearance revokes retained handlers through Surface's own
 * mount generation; unrelated sources and handler identities remain stable.
 */


import { NotFoundFailure, type PluginPin } from "@olai/format"
import { type BuiltPlugin, NO_ROSTER, type PluginRoster, type PluginState, type Who } from "@olai/surface/host"
import type { SurfaceSpec } from "@kolu/surface/define"
import { emptyHandlers, type ImplementSurfaceDeps, inMemoryStore, type MountedSurface, type SurfaceHandlers, type SurfaceRuntime } from "@kolu/surface/server"
import { Effect, Fiber, Queue, Stream } from "effect"
import type { Plugins, Registered, Wake } from "@olai/plugin-api/services"
import type { RowReport } from "@olai/bundle/bundle"
import { emitter } from "@olai/log"
import { hostSurface, hostFaces } from "@olai/surface/host"
import { composeCapabilities } from "./composition.ts"
import { authorityAt } from "@olai/plugin-api/authority"
import { CurrentWho } from "./who.ts"
export type Bound = Omit<SurfaceRuntime<typeof hostSurface.spec>, "ctx"> & { readonly writes: ReadonlyArray<string>; readonly dispatch?: Readonly<Record<string, { readonly field: string; readonly cases: ReadonlyArray<string> }>> }
export interface PluginRuntime {
  readonly plugins: Plugins
  readonly onChange: { run: () => void }
  readonly built: ReadonlyArray<string>
  readonly browserOnly?: ReadonlyArray<string>
  readonly pin: PluginPin
  readonly report: () => ReadonlyMap<string, RowReport>
  readonly names: () => ReadonlyMap<string, ReadonlyArray<string>>
  readonly configs: () => ReadonlyMap<string, Readonly<Record<string, unknown>>>
  readonly set: (id: string, enabled: boolean) => Effect.Effect<boolean>
  readonly reread: Effect.Effect<void>
  readonly switched: () => ReadonlySet<string>
  readonly catalogs?: () => ReadonlyArray<import("@olai/plugin-api/services").Catalog>
}
export interface Wiring {
  readonly hostname: string
  readonly startedAt: string
  readonly plugins: PluginRuntime | null
}
export const rosterOf = (
  offered: Wiring["plugins"],
  wakes: ReadonlyMap<string, Wake> = new Map(),
  offers: ReadonlyMap<string, string> = new Map(),
  defined: ReadonlyArray<BuiltPlugin> = [],
): PluginRoster =>
  offered === null ? NO_ROSTER : ((
    names: ReadonlyMap<string, ReadonlyArray<string>>,
  ) => ({
    built: [...offered.built.map((name) => {
      const report = offered.report().get(name) ?? { state: "off" as const }
      const said = stateOf(offered, name, report)
      const live = said.state === "running"
      const wake = live ? wakes.get(name) : undefined
      const carrying = live ? carriedBy(name, offered.built, names, offers) : []
      const config = offered.configs().get(name)
      return {
        name,
        running: live,
        ...(offered?.browserOnly?.includes(name) ? { browserOnly: true } : {}),
        state: said.state,
        ...(said.fault === undefined ? {} : { fault: said.fault }),
        ...(said.missing === undefined ? {} : { missing: said.missing }),
        ...(carrying.length === 0 ? {} : { carrying }),
        ...(wake === undefined ? {} : {
          wake: {
            subject: wake.subject,
            from: wake.from,
            waiting: wake.waiting,
            kinds: wake.kinds,
          },
        }),
        ...(config === undefined ? {} : { config }),
      }
    }), ...defined],
    pin: offered.pin,
    pinned: offered.pin.kind === "exact" ? offered.pin.names : null,
  }))(offered.names())
const carriedBy = (
  name: string,
  built: ReadonlyArray<string>,
  names: ReadonlyMap<string, ReadonlyArray<string>>,
  offers: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const held = new Set(
    [...offers].flatMap(([door, by]) => by === name ? [door] : []),
  )
  if (held.size === 0) return []
  return built.filter((row) =>
    row !== name && (names.get(row) ?? []).some((door) => held.has(door))
  )
}
const whoTurnedItOff = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
): PluginState => {
  if (offered.switched().has(name)) return "switched"
  return offered.pin.kind === "exact" ? "off" : "optIn"
}
const stateOf = (
  offered: NonNullable<Wiring["plugins"]>,
  name: string,
  report: RowReport,
): {
  readonly state: PluginState
  readonly fault?: string
  readonly missing?: ReadonlyArray<string>
} => {
  switch (report.state) {
    case "failed":
      return report.fault === undefined
        ? { state: "failed" }
        : { state: "failed", fault: report.fault }
    case "waiting":
      return report.missing === undefined || report.missing.length === 0
        ? { state: "waiting" }
        : { state: "waiting", missing: report.missing }
    case "off":
      return { state: whoTurnedItOff(offered, name) }
    case "running":
      return { state: "running" }
  }
}
const impl =
  <I, A, E>(answer: (input: I) => Effect.Effect<A, E>) =>
  ({ input }: { input: I }): Effect.Effect<A, E> => answer(input)
export const writerAt = (bound: Pick<Bound, "handlers" | "writes">, _ops: unknown, caller: { readonly writer: string; readonly fence?: unknown }): SurfaceHandlers => authorityAt(bound, caller)
export const bind = (wiring: Wiring) => Effect.gen(function*() {
    const runtimeScope = yield* Effect.scope
    const say = yield* emitter
    const ring = say
    let pluginsCell: { set: (value: PluginRoster) => void } | null = null
    const republishPlugins = () => pluginsCell?.set(roster())
    const offered = wiring.plugins
    const plugins = offered?.plugins ?? null
    const siblings = (): ReadonlyArray<Registered> => plugins?.composed() ?? []
    const rings = (): ReadonlyMap<string, Wake> => plugins?.declared() ?? new Map()
    const roster = (): PluginRoster =>
      rosterOf(
        offered,
        rings(),
        plugins?.offers() ?? new Map(),
        (offered?.catalogs?.() ?? []).flatMap(catalog => catalog.rows(offered?.report() ?? new Map())) as ReadonlyArray<BuiltPlugin>,
      )
    let settling: (run: Effect.Effect<boolean>) => Effect.Effect<boolean> = (run) => run
    const deps: ImplementSurfaceDeps<typeof hostSurface.spec> = {
      cells: { plugins: { store: inMemoryStore<PluginRoster>(roster()), connect: cell => Effect.sync(() => { pluginsCell = cell }) } },
      procedures: {
plugins: {
          set: ({ input }) =>
            Effect.gen(function*() {
              for (const catalog of offered?.catalogs?.() ?? []) {
                if (yield* settling(catalog.set(input.name, input.enabled))) return {}
              }
              if (offered !== null && (yield* settling(offered.set(input.name, input.enabled)))) {
                return {}
              }
              return yield* Effect.fail(
                new NotFoundFailure({
                  reason: `this build has no plugin named "${input.name}"`,
                  named: input.name,
                }),
              )
            }).pipe(
              Effect.forkIn(runtimeScope),
              Effect.flatMap(Fiber.join),
            ),
        },
who: {
          get: (() =>
            CurrentWho.use((who) => Effect.succeed(who))) as unknown as () => Effect.Effect<
              Who | null
            >,
        },
app: {
          get: () =>
            Effect.succeed({
              hostname: wiring.hostname,
              startedAt: wiring.startedAt,
            }),
        }
      },
    }
    const runtime = composeCapabilities(hostSurface, deps, hostFaces)
    const mounted = new Map<string, MountedSurface<SurfaceSpec>>()
    const recompose = (): void => {
      const wanted = new Map(siblings().map((one) => [one.name, one] as const))
      for (const [key, one] of wanted) {
        if (mounted.has(key)) continue
        const settling = leaving.get(key)
        if (settling !== undefined) {
          void settling.then(() => {
            if (!mounted.has(key)) recompose()
          })
          continue
        }
        const mount = runtime.mount(
          key,
          one.surface as never,
          one.deps as never,
          { root: one.root, writes: one.writes, dispatch: one.dispatch, faces: one.faces as never },
        )
        mounted.set(key, mount)
        one.published?.(mount.ctx)
      }
      for (const [key, mount] of [...mounted]) {
        if (wanted.has(key)) continue
        mounted.delete(key)
        const settling = mount.drop().catch((thrown: unknown) => {
          ring(
            Effect.logWarning(
              `plugins: "${key}" left the wire and its teardown failed — ${String(thrown)}`,
            ),
          )
        })
        leaving.set(key, settling)
        void settling.then(() => {
          if (leaving.get(key) === settling) leaving.delete(key)
        })
      }
      gates = gatesFor()
      if (!moving) republishPlugins()
    }
    const refreshPlugins = Effect.gen(function*() {
      pendingStatus = false
      yield* offered?.reread ?? Effect.void
      recompose()
    })
    settling = (run) =>
      Effect.gen(function*() {
        const changed = yield* Effect.ensuring(
          Effect.andThen(Effect.sync(() => { moving = true }), run),
          Effect.sync(() => { moving = false }),
        )
        if (changed || pendingStatus) yield* refreshPlugins
        return changed
      })
    let gates = runtime.faces as { browser: import("@kolu/surface/expose").FaceExposure, agent: import("@kolu/surface/expose").FaceExposure }
    const gatesFor = (): typeof gates => runtime.faces as typeof gates
    const leaving = new Map<string, Promise<void>>()
    let moving = false
    let pendingStatus = false
    recompose()
    if (offered !== null) {
      const statusChanges = yield* Queue.unbounded<void>()
      yield* Effect.addFinalizer(() => Queue.shutdown(statusChanges))
      offered.onChange.run = () => {
        recompose()
        Queue.offerUnsafe(statusChanges, undefined)
      }
      yield* Stream.runForEach(Stream.merge(offered.plugins.changes, Stream.fromQueue(statusChanges)), () =>
        Effect.suspend(() => {
          if (!moving) return refreshPlugins
          pendingStatus = true
          return Effect.void
        }),
      ).pipe(Effect.forkScoped)
    }
    return {
      bound: {
        get writes() { return runtime.writes },
        get dispatch() { return runtime.dispatch },
        get group() {
          return runtime.group
        },
        get handlers() {
          return runtime.handlers
        },
        done: runtime.done,
        close: runtime.close,
      },
      get faces() {
        return gates
      },
    }
  })
