import { type Accessor, createComponent, createContext, createMemo, type JSX, useContext } from "solid-js"
import type { CollectionDelta } from "@kolu/surface/define"
import type { CollectionFold } from "@kolu/surface/solid"
import { Effect, Result, type Stream } from "effect"

import type {
  FleetTerminal,
  KoluEvent,
  KoluLink,
  Snapshot,
  TerminalFrame,
  WatchPulse,
} from "olai-plugin-kolu/appliance/wire"
import { after, type Held, seeded } from "./held.ts"
import { KOLU_UNDIALED, SnapshotRefused } from "olai-plugin-kolu/appliance/wire"

export type ReadScreen = (terminal: string) => Promise<Snapshot | SnapshotRefused>

export type WatchTerminal = (
  input: {
    readonly terminal: string
    readonly grid?: { readonly cols: number; readonly rows: number }
  },
) => Stream.Stream<TerminalFrame, unknown>

export interface Fleet {
  readonly link: Accessor<KoluLink>
  readonly pulse: Accessor<WatchPulse | null | undefined>
  readonly terminals: () => ReadonlyMap<string, FleetTerminal>
  readonly events: () => ReadonlyMap<string, KoluEvent>
  readonly read?: ReadScreen
  readonly watch?: WatchTerminal
  readonly now: Accessor<number>
}

const FleetContext = createContext<Fleet>()

export interface FleetSources {
  readonly link: Accessor<KoluLink | undefined>
  readonly pulse: Accessor<WatchPulse | null | undefined>
  readonly fold: CollectionFold<string, FleetTerminal>
  readonly events: CollectionFold<string, KoluEvent>
  readonly watch?: WatchTerminal
  readonly read?: ReadScreen
}

export function createFleet(props: {readonly sources: FleetSources; readonly now: Accessor<number>}): Fleet {
  const held = props.sources.fold<Held>({
    init: seeded,
    step: (previous, delta: CollectionDelta<string, FleetTerminal>) =>
      after(previous, delta.upserts, delta.removes),
  })
  const ring = props.sources.events<Held<KoluEvent>>({
    init: seeded,
    step: (previous, delta: CollectionDelta<string, KoluEvent>) =>
      after(previous, delta.upserts, delta.removes),
  })
  const fleet: Fleet = {
    link: createMemo(() => props.sources.link() ?? KOLU_UNDIALED),
    pulse: props.sources.pulse,
    terminals: () => held()?.rows ?? NO_ROWS,
    events: () => ring()?.rows ?? NO_EVENTS,
    read: props.sources.read,
    watch: props.sources.watch,
    now: props.now,
  }
  return fleet
}

export function FleetProvider(props: ({readonly value: Fleet} | {readonly sources: FleetSources; readonly now: Accessor<number>}) & {readonly children: JSX.Element}) {
  const fleet = "value" in props ? props.value : createFleet(props)
  return createComponent(FleetContext.Provider, {value: fleet, get children() {return props.children}})
}

export const useFleet = (): Fleet =>
  useContext(FleetContext) ?? {
    link: () => KOLU_UNDIALED,
    pulse: () => null,
    terminals: () => NO_ROWS,
    events: () => NO_EVENTS,
    now: NEVER_TICKS,
  }

const NO_ROWS: ReadonlyMap<string, FleetTerminal> = new Map()

const NO_EVENTS: ReadonlyMap<string, KoluEvent> = new Map()

const NEVER_TICKS: Accessor<number> = () => 0

export const readingScreen = <E,>(
  call: (input: { terminal: string }) => Effect.Effect<Snapshot, E>,
): ReadScreen =>
(terminal) =>
  Effect.runPromise(Effect.result(call({ terminal }))).then(
    (outcome) => (Result.isSuccess(outcome) ? outcome.success : asRefusal(outcome.failure)),
    (thrown: unknown) => asRefusal(thrown),
  )

const asRefusal = (failure: unknown): SnapshotRefused => {
  if (
    typeof failure === "object" && failure !== null
    && (failure as { _tag?: unknown })._tag === "SnapshotRefused"
  ) {
    return failure as SnapshotRefused
  }
  console.warn("olai: a snapshot read failed in a way the pane does not model", failure)
  return new SnapshotRefused({
    reason: "no-padi",
    says: "olai could not read that screen — the detail is in the console.",
  })
}

export const watchingTerminal = (
  member: (
    input: {
      readonly terminal: string
      readonly grid?: { readonly cols: number; readonly rows: number }
    },
  ) => Stream.Stream<TerminalFrame, unknown>,
): WatchTerminal =>
(input) => member(input)
