import { type CellStore, inMemoryStore } from "@kolu/surface/server"
import { type Claimant } from "./fleet.ts"
import { makeMirror, type MirrorOptions } from "./mirror.ts"
import {
  type FleetTerminal,
  KOLU_UNDIALED,
  type KoluEvent,
  type KoluLink,
  type Snapshot,
  type TerminalFrame,
  SnapshotRefused,
  type WatchPulse,
} from "./wire/index.ts"
import { makeWatch, type Watch, type WatchConfig } from "./watch.ts"
import { Effect, Stream } from "effect"

export interface KoluDeps<N> {
  readonly options: MirrorOptions | null
  readonly fleet: () => {
    readonly upsert: (key: string, value: FleetTerminal) => void
    readonly remove: (key: string) => void
  } | undefined
  readonly events: () => {
    readonly upsert: (key: string, value: KoluEvent) => void
    readonly remove: (key: string) => void
  } | undefined
  readonly pulse: () => {
    readonly set: (value: WatchPulse) => void
  } | undefined
  readonly claimants: (nodes: ReadonlyArray<N>) => Iterable<Claimant>
  readonly config: (nodes: ReadonlyArray<N>, file: string | null) => {
    readonly config: WatchConfig
  }
  readonly rang?: (event: KoluEvent) => void
  readonly beating?: (everyMs: number) => void
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
}

export interface KoluHalf<N> {
  readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
  readonly rows: () => Map<string, FleetTerminal>
  readonly screen: (
    terminal: string,
    lines: number | undefined,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
  readonly handlers: KoluHandlers
  readonly revision: (nodes: ReadonlyArray<N>, file: string | null) => void

  readonly stop: () => void
}

export type VaultNode = unknown

export interface KoluHandlers {
  readonly cells: {
    readonly link: {
      readonly store: CellStore<KoluLink>
      readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
    }
    readonly pulse: {
      readonly store: CellStore<WatchPulse | null>
    }
  }
  readonly collections: {
    readonly fleet: {
      readonly readAll: () => Map<string, FleetTerminal>
      readonly upsert: () => void
      readonly remove: () => void
    }
    readonly events: {
      readonly readAll: () => Map<string, KoluEvent>
      readonly upsert: () => void
      readonly remove: () => void
    }
  }
  readonly streams: {
    readonly terminal: {
      readonly source: (
        input: { readonly terminal: string; readonly grid?: { cols: number; rows: number } },
      ) => Stream.Stream<TerminalFrame>
    }
  }
  readonly procedures: {
    readonly screen: {
      readonly text: (
        args: { readonly input: { readonly terminal: string; readonly lines?: number } },
      ) => Effect.Effect<Snapshot, SnapshotRefused>
    }
  }
}

export const SEED: KoluLink = KOLU_UNDIALED

const NO_LINK = new SnapshotRefused({
  reason: "no-padi",
  says: "this olai has no kolu link, so there is no screen to read.",
})

const NO_ROWS = new Map<string, FleetTerminal>()

export const koluHalf = <N,>(deps: KoluDeps<N>): KoluHalf<N> => {
  let pulse: WatchPulse | null = null
  const watch: Watch = makeWatch(
    {
      emit: (event) => {
        deps.events()?.upsert(event.id, event)
        deps.rang?.(event)
      },
      evict: (id) => deps.events()?.remove(id),
      beat: (at, everyMs) => {
        pulse = { at, everyMs }
        deps.pulse()?.set(pulse)
        deps.beating?.(everyMs)
      },
    },
    { now: () => Date.now(), say: deps.say, warn: deps.warn },
  )
  let mirror: ReturnType<typeof makeMirror> | undefined
  const revision = (nodes: ReadonlyArray<N>, file: string | null): void => {
    mirror?.reclaim(deps.claimants(nodes))
    const next = deps.config(nodes, file)
    watch.reconfigure(next.config)
  }
  if (deps.options === null) {
    return {
      connect: () => Effect.never,
      rows: () => NO_ROWS,
      screen: () => Effect.fail(NO_LINK),
      attach: () =>
        Stream.make({ kind: "refused", says: NO_LINK.says } as TerminalFrame),
      revision,
      stop: () => watch.stop(),
      handlers: linklessHandlers(watch, () => pulse),
    }
  }
  const { now } = deps.options
  let cell: { set: (value: KoluLink) => void } | undefined
  mirror = makeMirror(
    {
      link: (state) => cell?.set(state),
      upsert: (id, row) => {
        deps.fleet()?.upsert(id, row)
        watch.observe(id, row)
      },
      remove: (id) => deps.fleet()?.remove(id),
      clearedRow: (id) => deps.fleet()?.remove(id),
      face: (padi) => watch.attach(padi),
      say: deps.say,
    },
    deps.options,
  )
  const connect = (handle: { set: (value: KoluLink) => void }): Effect.Effect<void> =>
    Effect.suspend(() => {
      cell = handle
      return Effect.ensuring(mirror.run, Effect.sync(() => watch.stop()))
    })
  const screen = (terminal: string, lines: number | undefined) =>
    mirror.screen(terminal, lines, now)
  return {
    connect,
    rows: mirror.rows,
    screen,
    attach: mirror.attach,
    revision,
    stop: () => watch.stop(),
    handlers: handlersOf({
      connect,
      rows: mirror.rows,
      events: watch.events,
      pulse: () => pulse,
      screen,
      attach: mirror.attach,
    }),
  }
}

export { type Dial } from "./link.ts"
export { DEFAULT_LINES } from "./screen.ts"
export { PADI_SOCKET, type Rendezvous, rendezvousIn } from "./socket.ts"
export { type Claimant } from "./fleet.ts"
export { type MirrorOptions } from "./mirror.ts"
export {
  DEFAULT_WATCH,
  type HeldState,
  heldStateOf,
  makeWatch,
  WATCH_RING,
  type Watch,
  type WatchConfig,
} from "./watch.ts"
export { parseDuration, parseNag } from "@kolu/padi-client/watchDuration"

const handlersOf = (verbs: {
  readonly connect: (cell: { set: (value: KoluLink) => void }) => Effect.Effect<void>
  readonly rows: () => Map<string, FleetTerminal>
  readonly events: () => Map<string, KoluEvent>
  readonly pulse: () => WatchPulse | null
  readonly screen: (
    terminal: string,
    lines: number | undefined,
  ) => Effect.Effect<Snapshot, SnapshotRefused>
  readonly attach: (
    terminal: string,
    grid: { readonly cols: number; readonly rows: number } | undefined,
  ) => Stream.Stream<TerminalFrame>
}): KoluHandlers => ({
  cells: {
    link: {
      store: inMemoryStore<KoluLink>(SEED),
      connect: verbs.connect,
    },
    pulse: {
      store: { get: verbs.pulse, set: () => {} },
    },
  },
  collections: {
    fleet: {
      readAll: verbs.rows,
      upsert: () => {},
      remove: () => {},
    },
    events: {
      readAll: verbs.events,
      upsert: () => {},
      remove: () => {},
    },
  },
  streams: {
    terminal: {
      source: (input) => verbs.attach(input.terminal, input.grid),
    },
  },
  procedures: {
    screen: {
      text: ({ input }) => verbs.screen(input.terminal, input.lines),
    },
  },
})

const linklessHandlers = (
  watch: Watch,
  beat: () => WatchPulse | null,
): KoluHandlers =>
  handlersOf({
    connect: () => Effect.ensuring(Effect.never, Effect.sync(() => watch.stop())),
    rows: () => NO_ROWS,
    events: watch.events,
    pulse: beat,
    screen: () => Effect.fail(NO_LINK),
    attach: () => Stream.make({ kind: "refused", says: NO_LINK.says } as TerminalFrame),
  })
