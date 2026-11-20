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
    yield* Effect.sync(bench.free)
    while (state.unopened !== null) state = yield* Queue.take(seen)
    expect(state.status).toBe("idle")
    expect(attempts).toBe(2)
  })))
  expect(bench.held()).toBe(0)
})

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
    yield* Effect.sync(bench.free)
    while (state.unopened !== null) state = yield* Queue.take(seen)
    expect(state.status).toBe("idle")
    expect(attempts).toBe(3)
  })))
  expect(bench.held()).toBe(0)
})

test("a reading that is not a node's chat stays off, draws no refusal and waits for nothing", async () => {
  const bench = seatBench()
  let attempts = 0
  let released = 0
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const asked = yield* Deferred.make<void>()
    const seen = yield* Queue.unbounded<ChatState>()
    const source = yield* readings(Effect.succeed({
      reading: () => Effect.gen(function*() {
        attempts++
        yield* Effect.acquireRelease(Effect.void, () => Effect.sync(() => { released++ }))
        yield* Deferred.succeed(asked, undefined)
        return null
      }),
      seats: bench.seats,
    }))
    const to = { agent: "test", session: "replaced", current: true as const }
    yield* Effect.forkScoped(Stream.runForEach(source.state.source(to), value => Queue.offer(seen, value)))
    yield* Deferred.await(asked)
    yield* Effect.sync(bench.free)
    const late = Option.getOrThrow(yield* Stream.runHead(source.state.source(to)))
    expect(late).toEqual(CHAT_OFF)
    expect(attempts).toBe(1)
    expect(released).toBe(0)
    expect([...yield* Queue.takeAll(seen)].every(state => state.unopened === null)).toBe(true)
  })))
  expect(released).toBe(1)
})

const longRows = (count: number): Array<ChatEntry> =>
  Array.from({ length: count }, (_, at) => ({
    kind: "user" as const,
    id: `m${at}`,
    seq: at,
    since: "2020-01-01T00:00:00.000Z",
    text: `m${at}`,
  }))

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
    yield* Effect.forkScoped(Stream.runDrain(source.state.source(to)))
    yield* Deferred.await(filled)

    const snapshot = Option.getOrThrow(yield* Stream.runHead(source.transcript.source(to)))
    if (snapshot.kind !== "snapshot") throw new Error(`expected a snapshot, got a ${snapshot.kind}`)
    expect(snapshot.entries).toHaveLength(TRANSCRIPT_WINDOW)
    expect(snapshot.entries[0]?.[1].seq).toBe(40)

    const page = yield* source.page(to, 40, 10)
    expect(page.map((row) => row.seq)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39])
  })))
})
