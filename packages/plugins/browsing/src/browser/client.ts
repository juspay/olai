/**
 * WHAT THE PANE READS OF ITS OWN SIBLING, declared structurally against
 * `../wire.ts` — the shape `@kolu/surface/solid`'s client hands back for it.
 * Held once per activation, under one reactive root the activation disposes.
 */
import { unenrolledStreamCall } from "@kolu/surface/client"
import type { Effect, Stream } from "effect"
import { type Accessor, createMemo } from "solid-js"
import { DOWN, type Frame, type InputEvent, type ScreencastAsk, type Standing, type Tab } from "../wire.ts"

type Call<I, O = void> = (input: I) => Effect.Effect<O, unknown>

export interface BrowsingClient {
  readonly cells: { readonly standing: { readonly use: () => { readonly value: Accessor<Standing | undefined> } } }
  readonly collections: {
    readonly tabs: {
      readonly use: () => {
        readonly fold: <A>(options: {
          readonly init: (entries: ReadonlyArray<readonly [string, Tab]>) => A
          readonly step: (acc: A, delta: { readonly upserts: ReadonlyArray<readonly [string, Tab]>; readonly removes: ReadonlyArray<string> }) => A
        }) => Accessor<A | undefined>
      }
    }
  }
  readonly streams: { readonly screencast: { readonly unenrolled: unknown } }
  readonly procedures: {
    readonly tab: {
      readonly input: Call<{ readonly targetId: string; readonly event: InputEvent }>
      readonly navigate: Call<{ readonly targetId: string; readonly url: string }>
      readonly resize: Call<{ readonly targetId: string; readonly width: number; readonly height: number }>
      readonly open: Call<Record<string, never>, { readonly targetId: string }>
      readonly close: Call<{ readonly targetId: string }>
    }
    readonly browser: {
      readonly start: Call<Record<string, never>>
      readonly forgetSignIns: Call<Record<string, never>>
    }
  }
}

/** The pane's readings, one subscription each however many panes draw. */
export interface Browsing {
  readonly standing: Accessor<Standing>
  readonly tabs: Accessor<ReadonlyArray<Tab>>
  readonly tab: (id: string) => Tab | undefined
  /** The tab an address shows: its own, or `/browser`'s first. */
  readonly shown: (targetId: string | null) => string | null
  readonly watch: (ask: ScreencastAsk) => Stream.Stream<Frame, unknown>
  readonly calls: BrowsingClient["procedures"]
}

/** Must run under a reactive owner (the activation's root). */
export const createBrowsing = (client: BrowsingClient): Browsing => {
  const standing = client.cells.standing.use().value
  const folded = client.collections.tabs.use().fold<ReadonlyMap<string, Tab>>({
    init: (entries) => new Map(entries),
    step: (held, delta) => {
      const next = new Map(held)
      for (const id of delta.removes) next.delete(id)
      for (const [id, tab] of delta.upserts) next.set(id, tab)
      return next
    },
  })
  const tabs = createMemo(() => [...(folded()?.values() ?? [])])
  return {
    standing: () => standing() ?? DOWN,
    tabs,
    tab: (id) => folded()?.get(id),
    shown: (targetId) => targetId ?? tabs()[0]?.id ?? null,
    // Un-enrolled: a pane's screencast ends and reopens for ordinary reasons
    // (a tab closed, the browser stopped), and must not raise the app's
    // Disconnected overlay. The framework's retry fence still replays it
    // across a dropped socket.
    watch: (ask) => unenrolledStreamCall(client.streams.screencast.unenrolled as never, ask) as Stream.Stream<Frame, unknown>,
    calls: client.procedures,
  }
}
