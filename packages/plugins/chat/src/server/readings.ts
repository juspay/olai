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
import { Data, Effect, Exit, Queue, RcMap, Scope, Stream } from "effect"
import type { CollectionDeltasMsg } from "@kolu/surface/define"
import type { OpFailure } from "@olai/format"

import { type Cadence, cadence } from "../cadence.ts"
import type { Chat, ReadingObserver } from "../scoped.ts"
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
export const readings = (ready: Effect.Effect<Pick<Chat, "reading" | "seats">>) => Effect.gen(function*() {
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
      /**
       * A SEAT, WAITED FOR — one announcement, held until somebody takes it.
       *
       * The scheduler fans an announcement out to whoever is registered at
       * that instant and keeps no record of it ({@link Chat.seats}), so this
       * side has to do both of the things that makes safe. The registration
       * is the READING's, acquired beside the cadence above and released with
       * the scope that owns both: a listener that existed only while a fiber
       * was parked would miss every close that landed between one attempt
       * coming back and the next park — and two readings racing for two seats
       * is enough to lose one, with no *Try again* on that face to get out
       * with. And the announcement is REMEMBERED, which is what a queue of one
       * is: an offer with nobody taking stays until the next take, and a
       * second offer behind it slides the first out rather than queueing a
       * backlog, because "a seat freed since I last looked" is one bit and two
       * closes are not two seats for this reading to take.
       */
      const freed = yield* Queue.sliding<void>(1)
      yield* Effect.acquireRelease(
        Effect.sync(() => chat.seats(() => { Queue.offerUnsafe(freed, undefined) })),
        (off) => Effect.sync(off),
      )
      /**
       * THE ATTEMPT, KEPT — because this is the one refusal that mends itself.
       *
       * Every other reason an open fails is a thing a person has to do
       * something about, and the face says so and offers the retry. "All eight
       * agents are awake" is not: it stops being true the moment one of them
       * is put to sleep, and nothing about THIS conversation has to change for
       * it to open. So the attempt stays here, waiting on the scheduler's own
       * announcement, and the panel opens by itself.
       *
       * ONE OBSERVER ACROSS EVERY ATTEMPT, which is why it is a `const` and
       * not a literal in the call: a reader is held by IDENTITY (`scoped.ts`'s
       * `nodeReaders`), and a retry that handed over a fresh object would
       * leave the refused attempt's one behind — a reader nobody can release,
       * which is a slot the idle timer may never reap.
       *
       * EACH ATTEMPT GETS A SCOPE OF ITS OWN, closed when it fails. `reading`
       * registers its reader before it asks for a seat (`scoped.ts`), so a
       * refused attempt leaves a finalizer behind; on the reading's own scope
       * that is one more per retry, for the life of a tab. The SUCCESSFUL
       * attempt's scope is the one that must outlive the loop, so it is handed
       * to the reading's scope as a finalizer and released with it.
       *
       * THE LOOP IS OWNED BY THE READING, forked into its scope: a reader that
       * closes the tab takes the wait with it, and a serve shutting down
       * interrupts it where it stands.
       */
      const observer: ReadingObserver = {
        state: (value) => { state = value; for (const send of states) send(value) },
        transcript: clock.publish,
      }
      yield* Effect.forkScoped(Effect.gen(function*() {
        while (true) {
          const attempt = Scope.makeUnsafe()
          // THE HAND-OFF IS THE EXIT ITSELF, so there is no instant where the
          // child belongs to nobody: an open that SUCCEEDED gives its scope to
          // the reading's, and every other ending — refused, or the loop
          // interrupted mid-open — closes it where it stands.
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
