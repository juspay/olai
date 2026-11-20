import { Data, Effect, Exit, Queue, RcMap, Scope, Stream } from "effect"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import type { OpFailure } from "@olai/format"

import { type Cadence, cadence } from "../cadence.ts"
import type { Chat, ReadingObserver } from "../scoped.ts"
import type { PanelAddress } from "../wire/session.ts"
import { CHAT_OFF, type ChatEntry, type ChatState, TRANSCRIPT_WINDOW } from "../wire.ts"
import type { Saying } from "@kolu/acp/wire"

class Key extends Data.Class<{ readonly node: string | null; readonly agent: string | null; readonly session: string | null; readonly current: boolean }> {}

type Sink<A> = (value: A) => void
type Deltas<T> = CollectionDeltasMsg<string, T>
interface Reading {
  readonly state: () => ChatState
  readonly entries: ReadonlyMap<string, ChatEntry>
  readonly clock: Cadence
  readonly states: Set<Sink<ChatState>>
  readonly rows: Set<Sink<Deltas<ChatEntry>>>
  readonly pieces: Set<Sink<Deltas<Saying>>>
}

const keyOf = (to: PanelAddress): Key =>
  new Key("node" in to
    ? { node: to.node, agent: null, session: null, current: false }
    : { node: null, agent: to.agent, session: to.session, current: to.current === true })

const rowsBySeq = (entries: ReadonlyMap<string, ChatEntry>): Array<ChatEntry> =>
  [...entries.values()].sort((one, other) => one.seq - other.seq)

const newest = (entries: ReadonlyMap<string, ChatEntry>): Array<[string, ChatEntry]> =>
  rowsBySeq(entries).slice(-TRANSCRIPT_WINDOW).map((entry) => [entry.id, entry])

const pageOf = (
  entries: ReadonlyMap<string, ChatEntry>,
  before: number,
  limit: number,
): ReadonlyArray<ChatEntry> =>
  rowsBySeq(entries).filter((entry) => entry.seq < before).slice(-limit)

export const readings = (ready: Effect.Effect<Pick<Chat, "reading" | "seats">>) => Effect.gen(function*() {
  const held = yield* RcMap.make({
    lookup: (key: Key) => Effect.gen(function*() {
      const to: PanelAddress = key.node !== null
        ? { node: key.node }
        : { agent: key.agent!, session: key.session!, ...(key.current ? { current: true as const } : {}) }
      let state: ChatState = CHAT_OFF
      const entries = new Map<string, ChatEntry>()
      const states = new Set<Sink<ChatState>>()
      const rows = new Set<Sink<Deltas<ChatEntry>>>()
      const pieces = new Set<Sink<Deltas<Saying>>>()
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
      const freed = yield* Queue.sliding<void>(1)
      yield* Effect.acquireRelease(
        Effect.sync(() => chat.seats(() => { Queue.offerUnsafe(freed, undefined) })),
        (off) => Effect.sync(off),
      )
      const observer: ReadingObserver = {
        state: (value) => { state = value; for (const send of states) send(value) },
        transcript: clock.publish,
      }
      yield* Effect.forkScoped(Effect.gen(function*() {
        while (true) {
          const attempt = Scope.makeUnsafe()
          const opened = yield* Effect.result(
            Effect.provideService(chat.reading(to, observer), Scope.Scope, attempt).pipe(
              Effect.onExit(exit =>
                Exit.isSuccess(exit)
                  ? Effect.addFinalizer(() => Scope.close(attempt, Exit.void))
                  : Scope.close(attempt, Exit.void)),
            ),
          )
          if (opened._tag === "Success") return
          const failure = opened.failure
          const cause = failure._tag === "BusyFailure" ? failure.cause : undefined
          state = { ...CHAT_OFF, status: "idle", unopened: {
            what: "session" in to ? to.session : null,
            why: failure.message,
            ...(cause === undefined ? {} : { cause }),
          } }
          for (const send of states) send(state)
          if (cause?.kind !== "capacity") return
          yield* Queue.take(freed)
        }
      }))
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
    transcript: { source: (to: PanelAddress) => subscribe<Deltas<ChatEntry>>(to, (value, send) => {
      send({ kind: "snapshot", entries: newest(value.entries) })
      return value.rows
    }) },
    saying: { source: (to: PanelAddress) => subscribe<Deltas<Saying>>(to, (value, send) => {
      send({ kind: "snapshot", entries: [...value.clock.onWire()] })
      return value.pieces
    }) },
    page: (to: PanelAddress, before: number, limit: number) =>
      Effect.scoped(
        Effect.map(RcMap.get(held, keyOf(to)), (value) => pageOf(value.entries, before, limit)),
      ),
  }
})
