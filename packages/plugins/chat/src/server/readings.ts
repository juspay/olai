/** A conversation's three wire members share one reading and one cadence.
 * RcMap ties that resource to its subscribers and the chat server's scope.
 *
 * THE TRANSCRIPT HERE IS THE WHOLE CONVERSATION, and the window is a fact about
 * one DELIVERY of it: `transcript.source` ships the newest
 * {@link TRANSCRIPT_WINDOW} rows, and `page` (below) answers the older ones a
 * reader pulls by hand. The reading itself keeps everything — the page is read
 * off the same map — because what a tab is handed and what the server knows are
 * two different questions, and a window that bounded the READING would make
 * history unfetchable. */
import { Data, Effect, Queue, RcMap, Stream } from "effect"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import type { OpFailure } from "@olai/format"

import { type Cadence, cadence } from "../cadence.ts"
import type { Chat } from "../scoped.ts"
import type { PanelAddress } from "../wire/session.ts"
import { CHAT_OFF, type ChatEntry, type ChatState, type Saying, TRANSCRIPT_WINDOW } from "../wire.ts"

class Key extends Data.Class<{ readonly node: string | null; readonly agent: string | null; readonly session: string | null }> {}

type Sink<A> = (value: A) => void
type Rows<T> = CollectionDeltasMsg<string, T>
interface Reading {
  readonly state: () => ChatState
  readonly entries: ReadonlyMap<string, ChatEntry>
  readonly clock: Cadence
  readonly states: Set<Sink<ChatState>>
  readonly rows: Set<Sink<Rows<ChatEntry>>>
  readonly pieces: Set<Sink<Rows<Saying>>>
}

/** Which reading a `PanelAddress` names — the RcMap key, spelled once so the
 *  subscribe path and the page path cannot key one conversation two ways. */
const keyOf = (to: PanelAddress): Key =>
  new Key("node" in to ? { node: to.node, agent: null, session: null } : { node: null, ...to })

/** The newest {@link TRANSCRIPT_WINDOW} rows, in conversation order — what one
 *  subscribe ships. Sorted by `seq` rather than trusted to the map's insertion
 *  order, because the window's meaning is "the recent end of the CONVERSATION"
 *  and a map's order is a delivery detail. */
const rowsBySeq = (entries: ReadonlyMap<string, ChatEntry>): Array<ChatEntry> =>
  [...entries.values()].sort((one, other) => one.seq - other.seq)

const newest = (entries: ReadonlyMap<string, ChatEntry>): Array<[string, ChatEntry]> =>
  rowsBySeq(entries).slice(-TRANSCRIPT_WINDOW).map((entry) => [entry.id, entry])

/** The newest page of rows strictly below `before`, in conversation order. The
 *  newest `limit` of them, so a reader walking backwards never has to name an
 *  upper bound it has already seen. */
const pageOf = (
  entries: ReadonlyMap<string, ChatEntry>,
  before: number,
  limit: number,
): ReadonlyArray<ChatEntry> =>
  rowsBySeq(entries).filter((entry) => entry.seq < before).slice(-limit)

/** What a caller reads off a held reading without subscribing — the last member,
 *  the `conversation.earlier` verb's answer. It is not a stream: it is one reply
 *  to one request, and the reader that asked is the only one who wants it. */
export const readings = (ready: Effect.Effect<Pick<Chat, "reading">>) => Effect.gen(function*() {
  const held = yield* RcMap.make({
    lookup: (key: Key) => Effect.gen(function*() {
      const to: PanelAddress = key.node !== null ? { node: key.node } : { agent: key.agent!, session: key.session! }
      let state: ChatState = CHAT_OFF
      const entries = new Map<string, ChatEntry>()
      const states = new Set<Sink<ChatState>>()
      const rows = new Set<Sink<Rows<ChatEntry>>>()
      const pieces = new Set<Sink<Rows<Saying>>>()
      const clock = yield* Effect.acquireRelease(
        Effect.sync(() => cadence({ onFrame: (frame) => {
          for (const key of frame.rows.removes) entries.delete(key)
          for (const [key, value] of frame.rows.upserts) entries.set(key, value)
          for (const send of rows) send({ kind: "delta", upserts: frame.rows.upserts.map(([key, value]) => [key, value]), removes: [...frame.rows.removes] })
          for (const send of pieces) send({ kind: "delta", upserts: frame.pieces.upserts.map(([key, value]) => [key, value]), removes: [...frame.pieces.removes] })
        } })),
        (clock) => Effect.sync(clock.stop),
      )
      const chat = yield* ready
      yield* Effect.forkScoped(chat.reading(to, {
        state: (value) => { state = value; for (const send of states) send(value) },
        transcript: clock.publish,
      }).pipe(Effect.catch(failure => Effect.sync(() => {
        state = { ...CHAT_OFF, status: "idle", unopened: { what: "session" in to ? to.session : null, why: failure.message } }
        for (const send of states) send(state)
      }))))
      return { state: () => state, entries, clock, states, rows, pieces }
    }),
  })

  const subscribe = <A>(to: PanelAddress, connect: (
    value: Reading, send: Sink<A>,
  ) => Set<Sink<A>>) => Stream.callback<A, OpFailure>((queue) => Effect.gen(function*() {
    const value = yield* RcMap.get(held, keyOf(to))
    const send: Sink<A> = (frame) => { Queue.offerUnsafe(queue, frame) }
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const listeners = connect(value, send)
        listeners.add(send)
        return listeners
      }),
      (listeners) => Effect.sync(() => { listeners.delete(send) }),
    )
  })).pipe(Stream.orDie)

  return {
    state: { source: (to: PanelAddress) => subscribe<ChatState>(to, (value, send) => {
      send(value.state())
      return value.states
    }) },
    transcript: { source: (to: PanelAddress) => subscribe<Rows<ChatEntry>>(to, (value, send) => {
      send({ kind: "snapshot", entries: newest(value.entries) })
      return value.rows
    }) },
    saying: { source: (to: PanelAddress) => subscribe<Rows<Saying>>(to, (value, send) => {
      send({ kind: "snapshot", entries: [...value.clock.onWire()] })
      return value.pieces
    }) },
    page: (to: PanelAddress, before: number, limit: number) =>
      // SCOPED because an `RcMap.get` ACQUIRES a reference: the scope releases
      // it when the page is read, so a request does not pin the reading alive
      // behind the tabs that already hold it. A tab that has the conversation
      // open holds its own reference through its subscriptions, so the reading
      // it reads is the same one.
      Effect.scoped(
        Effect.map(RcMap.get(held, keyOf(to)), (value) => pageOf(value.entries, before, limit)),
      ),
  }
})
