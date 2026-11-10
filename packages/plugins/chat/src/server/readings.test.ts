import { BusyFailure } from "@olai/format"
import { expect, test } from "bun:test"
import { Deferred, Effect, Option, Queue, Stream } from "effect"
import { CHAT_OFF, type ChatEntry, type ChatState, TRANSCRIPT_WINDOW } from "../wire.ts"
import { readings } from "./readings.ts"

test("a shared reader publishes opening state before load finishes and releases its work", async () => {
  let acquired = 0
  let released = 0
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const opening = yield* Deferred.make<void>()
    const started = yield* Deferred.make<void>()
    const seen = yield* Queue.unbounded<ChatState>()
    const source = yield* readings(Effect.succeed({
      reading: (_to, observer) => Effect.gen(function*() {
        yield* Effect.acquireRelease(Effect.sync(() => { acquired++ }), () => Effect.sync(() => { released++ }))
        observer.state({ ...CHAT_OFF, status: "booting" })
        yield* Deferred.succeed(started, undefined)
        yield* Deferred.await(opening)
        observer.state({ ...CHAT_OFF, status: "idle" })
        return yield* Effect.never
      }),
      seats: () => () => {},
    }))
    const to = { agent: "test", session: "held" }
    yield* Effect.forkScoped(Stream.runDrain(source.transcript.source(to)))
    yield* Effect.forkScoped(Stream.runForEach(source.state.source(to), value => Queue.offer(seen, value)))
    let state = yield* Queue.take(seen)
    while (state.status !== "booting") state = yield* Queue.take(seen)
    yield* Deferred.await(started)
    expect(acquired).toBe(1)
    expect(released).toBe(0)
    yield* Deferred.succeed(opening, undefined)
    do { state = yield* Queue.take(seen) } while (state.status !== "idle")
  })))
  expect(released).toBe(1)
})


test("a scheduler refusal is published into the requested reading", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const source = yield* readings(Effect.succeed({
      reading: () => Effect.fail(new BusyFailure({ reason: "all agent slots are held" })),
      seats: () => () => {},
    }))
    const state = yield* Stream.runHead(source.state.source({ agent: "test", session: "ninth" }).pipe(
      Stream.filter(state => state.unopened !== null),
    ))
    expect(state).toMatchObject({ value: { unopened: { what: "ninth", why: "all agent slots are held" } } })
  })))
})

/** A scheduler's seat door, as the readings see it: whoever is registered at
 *  the instant of an announcement hears it, and nothing is remembered on this
 *  side — which is the shape the reading has to survive. */
const seatBench = () => {
  const listeners = new Set<() => void>()
  return {
    held: () => listeners.size,
    free: () => { for (const one of [...listeners]) one() },
    seats: (listen: () => void) => {
      listeners.add(listen)
      return () => { listeners.delete(listen) }
    },
  }
}

const capacity = new BusyFailure({
  reason: "All 8 agents are awake — put one to sleep in Chats.",
  cause: { kind: "capacity", capacity: 8 },
})

/**
 * THE ONE REFUSAL THAT MENDS ITSELF, held open from the reading's side.
 *
 * A full pool is not a fault: nothing about this conversation has to change
 * for it to open, so the attempt waits on the scheduler's own announcement and
 * the panel opens by itself. What is asserted is both halves — the sentence
 * and its cause reach the tab, and the SAME reading then goes live without
 * anybody subscribing again.
 */
test("a full pool holds the attempt, and the reading opens itself when a seat frees", async () => {
  const bench = seatBench()
  let attempts = 0
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen = yield* Queue.unbounded<ChatState>()
    const source = yield* readings(Effect.succeed({
      reading: (_to, observer) => Effect.suspend(() => {
        attempts++
        if (attempts === 1) return Effect.fail(capacity)
        observer.state({ ...CHAT_OFF, status: "idle" })
        return Effect.never
      }),
      seats: bench.seats,
    }))
    const to = { agent: "test", session: "ninth" }
    yield* Effect.forkScoped(Stream.runForEach(source.state.source(to), value => Queue.offer(seen, value)))
    let state = yield* Queue.take(seen)
    while (state.unopened === null) state = yield* Queue.take(seen)
    expect(state.unopened).toEqual({
      what: "ninth",
      why: "All 8 agents are awake — put one to sleep in Chats.",
      cause: { kind: "capacity", capacity: 8 },
    })
    // A SEAT FREES, and nobody presses anything: the attempt the reading kept
    // is retried where it stood.
    yield* Effect.sync(bench.free)
    while (state.unopened !== null) state = yield* Queue.take(seen)
    expect(state.status).toBe("idle")
    expect(attempts).toBe(2)
  })))
  expect(bench.held()).toBe(0)
})

/**
 * THE WAIT LEAVES WITH THE READING, asserted where it is actually load-bearing:
 * a reading that is STILL PARKED when its last subscriber goes.
 *
 * The earlier version of this claim freed a seat first and then checked the
 * count, which proved nothing — the announcement had already unregistered the
 * waiter. Here nothing ever frees a seat, so the only thing that can take the
 * listener off is the scope closing, which is the ownership this file is
 * responsible for.
 */
test("a reading that is still waiting for a seat takes its listener with it", async () => {
  const bench = seatBench()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen = yield* Queue.unbounded<ChatState>()
    const source = yield* readings(Effect.succeed({
      reading: () => Effect.fail(capacity),
      seats: bench.seats,
    }))
    yield* Effect.forkScoped(Stream.runForEach(
      source.state.source({ agent: "test", session: "forever" }),
      value => Queue.offer(seen, value),
    ))
    let state = yield* Queue.take(seen)
    while (state.unopened === null) state = yield* Queue.take(seen)
    expect(bench.held()).toBe(1)
  })))
  expect(bench.held()).toBe(0)
})

/**
 * AN ANNOUNCEMENT THAT LANDS BETWEEN TWO PARKS IS NOT LOST.
 *
 * This is the race two readings make for two seats: the first announcement
 * wakes both, one of them wins the scheduler's gate, and the second
 * announcement fires while the loser is INSIDE its retry rather than parked.
 * The scheduler keeps no record of it, so a listener that lived only for the
 * duration of a park would leave that reading waiting for something that has
 * already happened — and that face has no *Try again* on it.
 *
 * It is written as one reading and a fake that frees a seat from inside the
 * attempt, because that is the same instant and it is the deterministic way to
 * stand in it: attempt 2 announces and then refuses, so the latch is all there
 * is between it and attempt 3.
 */
test("a seat freed while the reading is between attempts is not lost", async () => {
  const bench = seatBench()
  let attempts = 0
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen = yield* Queue.unbounded<ChatState>()
    const source = yield* readings(Effect.succeed({
      reading: (_to, observer) => Effect.suspend(() => {
        attempts++
        if (attempts === 1) return Effect.fail(capacity)
        if (attempts === 2) {
          // The announcement nobody is parked for.
          bench.free()
          return Effect.fail(capacity)
        }
        observer.state({ ...CHAT_OFF, status: "idle" })
        return Effect.never
      }),
      seats: bench.seats,
    }))
    const to = { agent: "test", session: "loser" }
    yield* Effect.forkScoped(Stream.runForEach(source.state.source(to), value => Queue.offer(seen, value)))
    let state = yield* Queue.take(seen)
    while (state.unopened === null) state = yield* Queue.take(seen)
    // One real announcement starts the second attempt; the one that fires
    // inside it is the one a lost wakeup would drop.
    yield* Effect.sync(bench.free)
    while (state.unopened !== null) state = yield* Queue.take(seen)
    expect(state.status).toBe("idle")
    expect(attempts).toBe(3)
  })))
  expect(bench.held()).toBe(0)
})

/**
 * THE WINDOW AND THE PAGE — the two halves of juspay/olai#663's delivery.
 *
 * The transcript here is a hundred rows; the delivery is the newest
 * {@link TRANSCRIPT_WINDOW} of them (their oldest `seq` is the count a reader
 * derives), and the page is the run strictly below the cursor the tab names.
 * None of it is a claim about the transcript — the reading keeps every row, and
 * `page` reads them — so what is asserted is exactly the boundary the frame
 * moved.
 */
const longRows = (count: number): Array<[string, ChatEntry]> =>
  Array.from({ length: count }, (_, at) => [
    `m${at}`,
    { kind: "user", id: `m${at}`, seq: at, since: "2020-01-01T00:00:00.000Z", text: `m${at}` },
  ] as const)

test("a subscribe ships the newest window, and pages read the rest back", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const filled = yield* Deferred.make<void>()
    const source = yield* readings(Effect.succeed({
      reading: (_to, observer) => Effect.gen(function*() {
        observer.transcript({ upserts: longRows(TRANSCRIPT_WINDOW + 40), removes: [], appends: [] })
        yield* Deferred.succeed(filled, undefined)
        return yield* Effect.never
      }),
      seats: () => () => {},
    }))
    const to = { agent: "test", session: "long" }
    // The reading is built and filled by the first subscriber; a tab that joins
    // afterwards is the one that meets the window.
    yield* Effect.forkScoped(Stream.runDrain(source.state.source(to)))
    yield* Deferred.await(filled)

    const snapshot = Option.getOrThrow(yield* Stream.runHead(source.transcript.source(to)))
    if (snapshot.kind !== "snapshot") throw new Error(`expected a snapshot, got a ${snapshot.kind}`)
    expect(snapshot.entries).toHaveLength(TRANSCRIPT_WINDOW)
    // The window is the RECENT end: the oldest row it carries is the one that
    // leaves exactly `40` older — the oldest `seq` a tab would derive its door
    // from.
    expect(snapshot.entries[0]?.[1].seq).toBe(40)

    const page = yield* source.page(to, 40, 10)
    expect(page.map((row) => row.seq)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39])
  })))
})
