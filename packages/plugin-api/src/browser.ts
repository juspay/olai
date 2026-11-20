import { createLandings, type Landings as LandingTable } from "./carry.ts"

import {
  type Host,
  type Provision,
  type ServiceKey,
  hostChanges,
  openHost,
  offer,
  OfferConflict,
  provide,
  offered,
  settled,
  location,
  type Locations,
  type Location,
  type LocationOwner,
  serviceTag,
} from "@olai/effect-cordis"
import { BusyFailure, NotFoundFailure } from "@olai/format"
import { Effect, Scope, type Stream } from "effect"

import { BrowserMount } from "./mount.ts"
import { ownService, type OwnServices } from "./owned.ts"
import { kindWordOf } from "./contract.ts"
import { slotReference, type SlotDefinitions, type SlotKey } from "./slots.ts"
import type {
  AppClocks,
  AppPopover,
  FileLink,
  JSX,
  PillLook,
} from "./plugin.ts"

export * from "./runtime.ts"

/** Generic key rules; concrete location descriptors belong to their capabilities. */
export type { SlotKey } from "./slots.ts"

/** Browser providers publish only their own namespace. Core browser services
 * remain host-owned. This tag resolves independently of server Offers. */
export interface Offers extends OwnServices {}
export const Offers = serviceTag<Offers>("offers")

/** A location declared by an imported capability contract. */
export type SlotName = keyof SlotDefinitions & string

type SlotsKeyedBy<K extends SlotKey> = {
  [S in SlotName]: SlotDefinitions[S] extends {readonly keyedBy: K} ? S : never
}[SlotName]

/** Locations keyed by the contributing plugin. */
export type PluginSlot = SlotsKeyedBy<"plugin">

/** Locations keyed by a contributed kind. */
export type KindSlot = SlotsKeyedBy<"kind">

/** ...the eight nothing keys, which is what makes them lists. */
export type ListSlot = SlotsKeyedBy<"nothing">

/** ...and the one the APP keys, which is what makes it the only one. */
export type SingleSlot = SlotsKeyedBy<"app">

export type SlotFaces = { [S in SlotName]: SlotDefinitions[S] extends {readonly face: infer F} ? F : never }













/** One face, with the plugin that hung it — what a walk over a plugin-keyed slot
 *  or a LIST slot reads. The name is on the row because the app has occasion to
 *  use it (a testid, a mark looked up by the word core stamped on a chat row, the
 *  rank a bundle order is imposed by) and never to compose an address out of it.
 *
 *  In a list it is the only word there is: the table has no key, so a reader that
 *  wants to say WHOSE section this is, or to put two plugins' sections in the
 *  file's order, has this row and nothing else. */
export interface Hung<F> {
  readonly plugin: string
  readonly face: F
}

export type SlotOptions = Omit<NonNullable<Parameters<LocationOwner["contribute"]>[2]>, "key">
export interface Slots {
  /** Hang a face where the caller names no key: this plugin's one face in a
   *  plugin-keyed slot, its one claim on the app's single slot, or one more
   *  entry in a list — for as long as it is loaded. */
  readonly register: {
    <S extends PluginSlot | ListSlot | SingleSlot>(
      slot: S,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
    /** ...or dress one of this plugin's KINDS, by its bare word. */
    <S extends KindSlot>(
      slot: S,
      kind: string,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Slots = serviceTag<Slots>("ui-renderer.legacy-slots")

export interface Faces {
  /**
   * WHAT IS HUNG IN A PLUGIN-KEYED OR LIST SLOT, in REGISTRATION order — which
   * is arrival order, and is deliberately not a promise to anybody. A caller
   * that needs the bundle's order imposes it on the RESULT, against the list
   * that is written down (`@olai/web`'s own `hung` does).
   */
  readonly hung: <S extends PluginSlot | ListSlot>(slot: S) => ReadonlyArray<Hung<SlotFaces[S]>>
  /** ...and what dresses each COMPOSED KIND WORD in a kind-keyed slot. Keyed
   *  rather than ordered: a value wears at most one of these and the lookup is
   *  by the word the page's licence carries. */
  readonly dressed: <S extends KindSlot>(slot: S) => ReadonlyMap<string, SlotFaces[S]>
  /** ...and the one face in a single slot, or `null` where nobody has taken the
   *  seat. `null` rather than an empty array, because "there is at most one" is
   *  the thing the slot exists to say and a one-element array says it again in a
   *  shape every reader has to re-check. */
  readonly only: <S extends SingleSlot>(slot: S) => Hung<SlotFaces[S]> | null
}
export const Faces = serviceTag<Faces>("ui-renderer.faces")

/**
 * WHERE A VERB'S WRITE GOES — the browser's twin of {@link Kinds},
 * {@link Surfaces} and {@link Wakes}, and one table per attached app.
 *
 * A row that owns an `edit.apply` arm CLAIMS the verbs it implements; anything
 * with an edit in hand SPENDS one. {@link openApp} supplies the table, so no
 * row stands behind it and naming it costs a consumer no wait.
 *
 * An `Edit` and an `Applied` are `@olai/surface`'s, so the door is spelled
 * structurally here and cast with the real types at both ends.
 */
export interface EditWriters {
  /**
   * CLAIM THESE VERBS for as long as the calling activation stands, and clear
   * BY IDENTITY — so a stopped activation whose finalizer runs after a
   * replacement claimed the verb cannot take the replacement's writer out from
   * under an edit in flight. A second claimant is a DEFECT.
   */
  readonly register: (
    verbs: ReadonlyArray<string>,
    write: (edit: never) => Effect.Effect<unknown, unknown>,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** ...and the dispatch, refusing in words for a verb whose row is not here. */
  readonly write: (edit: { readonly verb: string }) => Effect.Effect<unknown, unknown>
}
export const Edits = serviceTag<EditWriters>("edit-writers")

/**
 * ONE ROW'S WRITE, for the moment its client may already be gone — a roster
 * redial can withdraw the row that owns the verb between the gesture and the
 * dispatch, and `Wired.client()` is then `null`. Refuses through the same door
 * every other departed-client path lands on rather than reaching through it.
 */
export const editApply = (
  client: {
    readonly procedures: {
      readonly edit: { apply(edit: never): Effect.Effect<unknown, unknown> }
    }
  } | null,
  edit: never,
): Effect.Effect<unknown, unknown> =>
  client === null
    ? Effect.fail(
      new BusyFailure({
        reason: "the plugin serving this edit left the wire before the server applied it",
      }),
    )
    : client.procedures.edit.apply(edit)

/** One host-owned landing table per app; consumers scope their registrations. */
export const Landings = serviceTag<LandingTable>("landings")

/**
 * A TABLE FOR AN APP THAT IS NOT STANDING — what a package's own holder answers
 * with before its row has held one, and after it has stopped.
 *
 * The refusal is the SAME sentence a verb whose provider left already got, so a
 * face that somehow outlived its row says what it has always said rather than
 * throwing inside a click handler.
 */
export const NO_EDITS: EditWriters = {
  register: () => Effect.die(new Error("edit writers: registered into a table nobody is holding")),
  write: (edit) => Effect.fail(new NotFoundFailure({ reason: `the capability for ${edit.verb} is not active` })),
}

const editWriters = (): EditWriters => {
  const writers = new Map<string, (edit: never) => Effect.Effect<unknown, unknown>>()
  return {
    register: (verbs, write) =>
      Effect.acquireRelease(
        Effect.sync((): ReadonlyArray<string> => {
          const taken = verbs.filter((verb) => writers.has(verb))
          if (taken.length === 0) for (const verb of verbs) writers.set(verb, write)
          return taken
        }),
        (taken) => Effect.sync(() => {
          if (taken.length > 0) return
          for (const verb of verbs) if (writers.get(verb) === write) writers.delete(verb)
        }),
      ).pipe(Effect.flatMap((taken) =>
        taken.length === 0
          ? Effect.void
          : Effect.die(new Error(`edit writer already registered: ${taken.join(", ")}`)),
      )),
    write: (edit) =>
      Effect.suspend(() => {
        const write = writers.get(edit.verb)
        return write === undefined
          ? Effect.fail(new NotFoundFailure({ reason: `the capability for ${edit.verb} is not active` }))
          : write(edit as never)
      }),
  }
}

/**
 * ONE ROW'S OWN HOLD ON THE TABLE IT READS — the shape a plugin whose FACES
 * read a slot is written with.
 *
 * A FACTORY, not a place. Calling it mints one holder; two callers get two
 * holders, and nothing here is module scope.
 *
 * {@link HeldFaces.hold} is an acquisition on the CALLING activation's scope
 * and clears BY THE HOLD, so a stopped activation cannot clear the value a
 * replacement installed.
 *
 * IT IS ONE SLOT: a second hold displaces the first, and releasing the second
 * leaves the first consumer reading the empty answer. So a holder belongs to
 * ONE consumer — two consumers with two lifetimes are two holders.
 *
 * A read before the hold answers the empty table rather than throwing, and
 * such a read is UNTRACKED: the tracking is `Faces`' own
 * (`AppConfig.reading`), so there is nothing to subscribe to while the service
 * is absent.
 */
export interface HeldFaces extends Faces {
  readonly hold: (faces: Faces) => Effect.Effect<void, never, Scope.Scope>
}
export const heldFaces = (): HeldFaces => {
  let held: { readonly faces: Faces } | undefined
  return {
    hold: (faces) => Effect.suspend(() => {
      const own = { faces }
      return Effect.acquireRelease(
        Effect.sync(() => { held = own }),
        () => Effect.sync(() => { if (held === own) held = undefined }),
      )
    }),
    hung: (slot) => held?.faces.hung(slot) ?? [],
    dressed: (slot) => held?.faces.dressed(slot) ?? new Map(),
    only: (slot) => held?.faces.only(slot) ?? null,
  }
}

export type Clocks = AppClocks
export const Clocks = serviceTag<Clocks>("ui-renderer.clocks")

/**
 * THE BAR — its geometry, its breakpoint and the popover that shares its one
 * focus cycle. `desktop` is the BAR's fact: the pills are desktop-only, and a
 * plugin answering that out of its own media query would be a second answer to
 * the app's breakpoint.
 */
export interface Bar {
  readonly desktop: () => boolean
  /** The pill's classes — the box is the bar's and what is drawn inside it is
   *  the plugin's, which is why this is classes rather than a component. */
  readonly pill: PillLook
  /** A panel that hangs off a chrome pill, whole: the portal, the layer, the
   *  anchor and the focus cycle already spent. */
  readonly popover: () => AppPopover
}
export const Bar = serviceTag<Bar>("layout.bar")

/** A DOOR ONTO A SERVED FILE — the app's router and its address grammar as the
 *  one thing a plugin wants out of them. Its own service rather than a field on
 *  the bar because it has nothing to do with the bar: a chip deep in a property
 *  run links to a file, and it draws nowhere near the chrome. */
export interface Links {
  readonly File: FileLink
}
export const Links = serviceTag<Links>("navigation.links")

/**
 * THIS PLUGIN'S OWN SIBLING CLIENT, KEYED BY THE PLUGIN and not by an
 * argument: a client addressed by a name a caller supplies is a client one
 * plugin can ask for another's members through.
 *
 * `unknown`, because core cannot type a plugin's client without learning its
 * members. It travels opaque and is narrowed by the plugin, once, at its own
 * edge.
 *
 * `null` is a plugin whose sibling this wire does not carry, which is a plugin
 * that draws its nothing-here arm rather than a failure.
 */
export interface Wired {
  readonly client: () => unknown
}
export const Wired = serviceTag<Wired>("wired")

export interface App extends Faces {
  readonly settlePlugins: (ids: ReadonlyArray<string>) => Effect.Effect<void>
  readonly settled: Effect.Effect<void>
  readonly integrations: Locations["inspect"]
  readonly retryIntegrations: Effect.Effect<void>
  /** Mount the renderer, in the build's own row order — see
   *  {@link BrowserMount.rank}, which is the one place that order is supplied
   *  and the reason no reader of a slot imposes one of its own. */
  readonly attach: (
    element: Element,
    rank?: (plugin: string) => number,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** State changes even when a waiting component registered no faces. */
  readonly changes: Stream.Stream<void>
  /** Where the plugins hang — handed to `mountPlugin` and opaque to everybody. */
  readonly host: Host
  /** Install an explicitly supplied host capability in the caller's scope. */
  readonly supply: <T>(key: ServiceKey<T>, value: T) => Effect.Effect<void, never, Scope.Scope>

}

export interface AppConfig {
  readonly ownerFor?: (fiber: string) => string
  readonly changed?: () => void
  readonly reading?: () => void
  readonly clientFor?: (plugin: string) => unknown
}

/**
 * OPEN THE TAB'S PLUGIN RUNTIME — the host, the services on it, and the three
 * reads back.
 *
 * SCOPED, because every `provide` is; in a tab that scope is the page's, which
 * is the process.
 */
export const openApp = (config: AppConfig = {}): Effect.Effect<App, never, Scope.Scope> =>
  Effect.gen(function*() {
    const host = yield* openHost
    const forOwner = <Shape>(provision: Provision<Shape>): Provision<Shape> => (fiber, lifetime) =>
      provision(config.ownerFor?.(fiber) ?? fiber, lifetime)
    yield* provide(host, Offers, forOwner((plugin) => ({
      own: ownService(plugin, (key, door) => offer(key, forOwner(door)).pipe(
        Effect.catchDefect((defect) => Effect.die(
          defect instanceof OfferConflict
            ? new Error(`plugins: "${defect.owner}" and "${plugin}" both offer "${key.cordis}"`)
            : defect,
        )),
      )),
    })))
    yield* provide(host, Wired, forOwner((plugin) => ({
      client: () => config.clientFor?.(plugin) ?? null,
    })))
    const landings = createLandings()
    yield* provide(host, Landings, () => landings)
    const edits = editWriters()
    yield* provide(host, Edits, () => edits)

    const faces: Faces = {
      hung: (slot) => { config.reading?.(); return offered(host, Faces)?.hung(slot) ?? [] },
      dressed: (slot) => { config.reading?.(); return offered(host, Faces)?.dressed(slot) ?? new Map() },
      only: (slot) => { config.reading?.(); return offered(host, Faces)?.only(slot) ?? null },
    }

    return {
      ...faces,
      settlePlugins: (ids) => settled(host, ids),
      settled: Effect.suspend(() => offered(host, SlotManagement)?.settled ?? Effect.void),
      integrations: () => offered(host, SlotManagement)?.inspect() ?? [],
      retryIntegrations: Effect.suspend(() => offered(host, SlotManagement)?.retry ?? Effect.void),
      attach: (element, rank) => provide(host, BrowserMount, () => ({
        element, changed: config.changed, reading: config.reading, rank,
      })),
      supply: (key, value) => provide(host, key, () => value),
      host,
      changes: hostChanges(host),

    }
  })

/** Typed compatibility contracts for existing notebook extensions. These are
 * locations in the renderer's sole registry, never independent tables. The
 * owning UI entry must declare them before registered faces become active. */
export const slotLocation = <S extends SlotName>(slot: S) => slotReference<SlotFaces[S]>(slot)

const SlotManagement = serviceTag<Pick<Locations, "inspect" | "settled" | "retry">>("ui-renderer.integrations")
export const slotFacade = (
  store: Locations,
  reading?: () => void,
  rank: (plugin: string) => number = () => 0,
): {
  readonly forOwner: (owner: string) => Slots
  readonly faces: Faces
  readonly management: Pick<Locations, "inspect" | "settled" | "retry">
} => ({
  management: { inspect: store.inspect, settled: store.settled, retry: store.retry },
  forOwner: (plugin) => ({
    register: ((slot: SlotName, second: unknown, third?: unknown, fourth?: SlotOptions) => {
      const keyed = typeof second === "string"
      const key = keyed ? kindWordOf(plugin, second) : undefined
      return store.forOwner(plugin).contribute(slotLocation(slot), {
        plugin, face: (keyed ? third : second) as SlotFaces[SlotName],
      }, { ...(keyed ? fourth : third as SlotOptions | undefined), key })
    }) as Slots["register"],
  }),
  faces: {
    hung: (slot) => {
      reading?.()
      return store.read(slotLocation(slot)).map((entry) => entry.value)
        .sort((one, other) => rank(one.plugin) - rank(other.plugin))
    },
    dressed: (slot) => {
      reading?.()
      return new Map(store.read(slotLocation(slot)).map((entry) => [entry.key!, entry.value.face]))
    },
    only: (slot) => { reading?.(); return store.read(slotLocation(slot))[0]?.value ?? null },
  },
})
