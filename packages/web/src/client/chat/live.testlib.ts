/**
 * A LIVE CONVERSATION WITH SOMETHING WATCHING IT, and a count of what watching
 * it costs.
 *
 * The two snapshots the open panel publishes — the pill's last agent message
 * (`./last.ts`) and the banner's pending question (`./attention/asked.ts`) —
 * make the same claim about what they READ, and it is a claim only a count can
 * hold: written as a loop over every row's value, either would re-walk the
 * whole transcript per streamed token
 * (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/reactivity-after-the-flip.md §4.4). So the fake `Chat`
 * below counts how many times a row's VALUE was pulled, and both browsertests
 * are about that number.
 *
 * The chat is the two things a scan actually asks of a `Chat`: the key list —
 * the fold's, which hands back the same array while only text moves
 * (`./order.ts`) — and one signal per row. Nothing else is stubbed, because
 * nothing else is read.
 *
 * Made inside a root, and the rows are added from OUTSIDE it, because a Solid
 * effect does not run inside the body that created it: a case that asserted in
 * there would be asserting about an effect that had not run yet.
 *
 * A `.testlib.ts` rather than a `.test.ts` (the convention `frame.testlib.ts`
 * and `fakeSocket.testlib.ts` already keep): it is imported by a suite, not
 * discovered as one.
 */

import { type Accessor, createRoot, createSignal } from "solid-js"

import type { ChatEntry } from "@olai/surface"
import type { Chat } from "./state.ts"

/** Rows as the transcript carries them, with only the fields a scan reads. */
export const agentRow = (seq: number, text: string): ChatEntry =>
  ({ kind: "agent", seq, text } as unknown as ChatEntry)

export const userRow = (seq: number, text: string): ChatEntry =>
  ({ kind: "user", seq, text } as unknown as ChatEntry)

/** A question, waiting or settled — the one row kind whose value MOVES under a
 *  key that does not. */
export const askRow = (
  seq: number,
  id: string,
  text: string,
  settled = false,
): ChatEntry =>
  ({
    kind: "ask",
    seq,
    id,
    text,
    ask: { fields: [], outcome: settled ? { how: "answered", answers: [] } : null },
  } as unknown as ChatEntry)

export interface Live {
  /** How many times a row's value has been pulled since this began — the whole
   *  measurement: a walk of the transcript per token shows up here as rows ×
   *  tokens. */
  readonly reads: () => number
  /** Dispose the root, which is what a panel closing does. */
  readonly stop: () => void
  /** A row arrives: the key list grows, which is the only thing membership can
   *  do. */
  readonly add: (key: string, entry: ChatEntry) => void
  /** ... and a frame lands on one: its value moves, the key list does not. */
  readonly token: (key: string, entry: ChatEntry) => void
}

/** Mount `watch` over a conversation this returns the handle to. */
export const live = (watch: (chat: Chat) => void): Live => {
  const keysHeld: Array<string> = []
  const [keys, setKeys] = createSignal<ReadonlyArray<string>>(keysHeld)
  const rows = new Map<
    string,
    readonly [Accessor<ChatEntry | undefined>, (next: ChatEntry) => void]
  >()
  let reads = 0
  const chat = {
    rows: keys,
    entry: (key: string): Accessor<ChatEntry | undefined> => () => {
      reads += 1
      return rows.get(key)?.[0]()
    },
  } as unknown as Chat
  const stop = createRoot((dispose) => {
    watch(chat)
    return dispose
  })
  return {
    reads: () => reads,
    stop,
    add: (key, entry) => {
      const [value, set] = createSignal<ChatEntry | undefined>(entry)
      rows.set(key, [value, set])
      keysHeld.push(key)
      setKeys([...keysHeld])
    },
    token: (key, entry) => rows.get(key)?.[1](entry),
  }
}
