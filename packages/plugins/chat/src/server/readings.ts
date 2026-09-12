/** A conversation's three wire members share one reading and one cadence.
 * RcMap ties that resource to its subscribers and the chat server's scope. */
import { Data, Effect, Queue, RcMap, Stream } from "effect"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import type { OpFailure } from "@olai/format"

import { type Cadence, cadence } from "../cadence.ts"
import type { Chat } from "../scoped.ts"
import type { Conversing } from "../sessions.ts"
import { CHAT_OFF, type ChatEntry, type ChatState, type Saying } from "../wire.ts"

class Key extends Data.Class<Conversing> {}

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

export const readings = (ready: Effect.Effect<Pick<Chat, "reading">>) => Effect.gen(function*() {
  const held = yield* RcMap.make({
    lookup: (to: Conversing) => Effect.gen(function*() {
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
        state = { ...CHAT_OFF, status: "idle", unopened: { what: to.session, why: failure.message } }
        for (const send of states) send(state)
      }))))
      return { state: () => state, entries, clock, states, rows, pieces }
    }),
  })

  const subscribe = <A>(to: Conversing, connect: (
    value: Reading, send: Sink<A>,
  ) => Set<Sink<A>>) => Stream.callback<A, OpFailure>((queue) => Effect.gen(function*() {
    const value = yield* RcMap.get(held, new Key(to))
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
    state: { source: (to: Conversing) => subscribe<ChatState>(to, (value, send) => {
      send(value.state())
      return value.states
    }) },
    transcript: { source: (to: Conversing) => subscribe<Rows<ChatEntry>>(to, (value, send) => {
      send({ kind: "snapshot", entries: [...value.entries] })
      return value.rows
    }) },
    saying: { source: (to: Conversing) => subscribe<Rows<Saying>>(to, (value, send) => {
      send({ kind: "snapshot", entries: [...value.clock.onWire()] })
      return value.pieces
    }) },
  }
})
