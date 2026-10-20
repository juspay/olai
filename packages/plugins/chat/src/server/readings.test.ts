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
    }))
    const state = yield* Stream.runHead(source.state.source({ agent: "test", session: "ninth" }).pipe(
      Stream.filter(state => state.unopened !== null),
    ))
    expect(state).toMatchObject({ value: { unopened: { what: "ninth", why: "all agent slots are held" } } })
  })))
})

/**
 * THE WINDOW, THE COUNT AND THE PAGE — the three halves of juspay/olai#663, over
 * one long reading.
 *
 * The transcript here is a hundred rows; the delivery is the newest
 * {@link TRANSCRIPT_WINDOW} of them, the count is what was left behind, and the
 * page is the run strictly below the cursor the tab names. None of the three is
 * a claim about the transcript — the reading keeps every row, and `page` reads
 * them — so what is asserted is exactly the boundary the frame moved.
 */
const longRows = (count: number): Array<[string, ChatEntry]> =>
  Array.from({ length: count }, (_, at) => [
    `m${at}`,
    { kind: "user", id: `m${at}`, seq: at, since: "2020-01-01T00:00:00.000Z", text: `m${at}` },
  ] as const)

test("a subscribe ships the newest window, the count of the rest, and pages read the rest back", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const filled = yield* Deferred.make<void>()
    const source = yield* readings(Effect.succeed({
      reading: (_to, observer) => Effect.gen(function*() {
        observer.transcript({ upserts: longRows(TRANSCRIPT_WINDOW + 40), removes: [], appends: [] })
        yield* Deferred.succeed(filled, undefined)
        return yield* Effect.never
      }),
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
    // leaves exactly `40` older.
    expect(snapshot.entries[0]?.[1].seq).toBe(40)

    expect(Option.getOrThrow(yield* Stream.runHead(source.earlier.source(to)))).toBe(40)

    const page = yield* source.page(to, 40, 10)
    expect(page.map((row) => row.seq)).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38, 39])
  })))
})
