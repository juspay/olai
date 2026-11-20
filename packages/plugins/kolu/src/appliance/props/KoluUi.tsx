import { createComponent, type Accessor, type JSX } from "solid-js"

import { unenrolledStreamCall } from "@kolu/surface/client"
import type { Effect, Stream } from "effect"

import type {
  FleetTerminal,
  KoluEvent,
  KoluLink,
  Snapshot,
  TerminalFrame,
  WatchPulse,
} from "olai-plugin-kolu/appliance/wire"

import { createFleet, type Fleet, FleetProvider, readingScreen, watchingTerminal } from "./fleet.tsx"

export interface KoluClient {
  readonly cells: {
    readonly link: {
      use: () => { readonly value: Accessor<KoluLink | undefined> }
    }
    readonly pulse: {
      use: () => { readonly value: Accessor<WatchPulse | null | undefined> }
    }
  }
  readonly collections: {
    readonly fleet: { use: () => { readonly fold: unknown } }
    readonly events: { use: () => { readonly fold: unknown } }
  }
  readonly procedures: {
    readonly screen: {
      readonly text: (input: { terminal: string }) => Effect.Effect<Snapshot, unknown>
    }
  }
  readonly streams: {
    readonly terminal: {
      readonly unenrolled: unknown
    }
  }
}

export function createKoluUi(props: {readonly client: KoluClient; readonly now: Accessor<number>}): Fleet {
  return createFleet({now:props.now,sources: {
        link: props.client.cells.link.use().value,
        pulse: props.client.cells.pulse.use().value,
        fold: props.client.collections.fleet.use().fold as never,
        events: props.client.collections.events.use().fold as never,
        read: readingScreen(props.client.procedures.screen.text),
        watch: watchingTerminal((input) =>
          unenrolledStreamCall(
            props.client.streams.terminal.unenrolled as never,
            input,
          ) as Stream.Stream<TerminalFrame, unknown>
        ),
      }})
}

export function KoluUi(props: {readonly value: Fleet; readonly children: JSX.Element}): JSX.Element {
  return createComponent(FleetProvider, {get value() {return props.value}, get children() {return props.children}})
}

export type { FleetTerminal }
