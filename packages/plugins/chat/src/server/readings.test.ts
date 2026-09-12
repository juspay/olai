import { BusyFailure } from "@olai/format"
import { expect, test } from "bun:test"
import { Deferred, Effect, Queue, Stream } from "effect"
import { CHAT_OFF, type ChatState } from "../wire.ts"
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
