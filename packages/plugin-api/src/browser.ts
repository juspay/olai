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

export type { SlotKey } from "./slots.ts"

export interface Offers extends OwnServices {}
export const Offers = serviceTag<Offers>("offers")

export type SlotName = keyof SlotDefinitions & string

type SlotsKeyedBy<K extends SlotKey> = {
  [S in SlotName]: SlotDefinitions[S] extends {readonly keyedBy: K} ? S : never
}[SlotName]

export type PluginKeyedSlot = SlotsKeyedBy<"plugin">
export type KindKeyedSlot = SlotsKeyedBy<"kind">
export type UnkeyedSlot = SlotsKeyedBy<"nothing">
export type AppKeyedSlot = SlotsKeyedBy<"app">

export type SlotFaces = { [S in SlotName]: SlotDefinitions[S] extends {readonly face: infer F} ? F : never }

export interface Hung<F> {
  readonly plugin: string
  readonly face: F
}

export type SlotOptions = Omit<NonNullable<Parameters<LocationOwner["contribute"]>[2]>, "key">
export interface Slots {
  readonly register: {
    <S extends PluginKeyedSlot | UnkeyedSlot | AppKeyedSlot>(
      slot: S,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
    <S extends KindKeyedSlot>(
      slot: S,
      bareKind: string,
      face: SlotFaces[S],
      options?: SlotOptions,
    ): Effect.Effect<void, never, Scope.Scope>
  }
}
export const Slots = serviceTag<Slots>("ui-renderer.legacy-slots")

export interface Faces {
  readonly hung: <S extends PluginKeyedSlot | UnkeyedSlot>(slot: S) => ReadonlyArray<Hung<SlotFaces[S]>>
  readonly dressed: <S extends KindKeyedSlot>(slot: S) => ReadonlyMap<string, SlotFaces[S]>
  readonly only: <S extends AppKeyedSlot>(slot: S) => Hung<SlotFaces[S]> | null
}
export const Faces = serviceTag<Faces>("ui-renderer.faces")

export interface EditWriters {
  readonly register: (
    verbs: ReadonlyArray<string>,
    write: (edit: never) => Effect.Effect<unknown, unknown>,
  ) => Effect.Effect<void, never, Scope.Scope>
  readonly write: (edit: { readonly verb: string }) => Effect.Effect<unknown, unknown>
}
export const Edits = serviceTag<EditWriters>("edit-writers")

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

export const Landings = serviceTag<LandingTable>("landings")

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

export interface SingleConsumerFaces extends Faces {
  readonly hold: (faces: Faces) => Effect.Effect<void, never, Scope.Scope>
}
export const singleConsumerFaces = (): SingleConsumerFaces => {
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

export interface Bar {
  readonly desktop: () => boolean
  readonly pill: PillLook
  readonly popover: () => AppPopover
}
export const Bar = serviceTag<Bar>("layout.bar")

export interface Links {
  readonly File: FileLink
}
export const Links = serviceTag<Links>("navigation.links")

export interface Wired {
  readonly client: () => unknown
}
export const Wired = serviceTag<Wired>("wired")

export interface App extends Faces {
  readonly settlePlugins: (ids: ReadonlyArray<string>) => Effect.Effect<void>
  readonly settled: Effect.Effect<void>
  readonly integrations: Locations["inspect"]
  readonly retryIntegrations: Effect.Effect<void>
  readonly attach: (
    element: Element,
    rank?: (plugin: string) => number,
  ) => Effect.Effect<void, never, Scope.Scope>
  readonly changes: Stream.Stream<void>
  readonly host: Host
  readonly supply: <T>(key: ServiceKey<T>, value: T) => Effect.Effect<void, never, Scope.Scope>
}

export interface AppConfig {
  readonly ownerFor?: (fiber: string) => string
  readonly changed?: () => void
  readonly reading?: () => void
  readonly clientFor?: (plugin: string) => unknown
}

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
