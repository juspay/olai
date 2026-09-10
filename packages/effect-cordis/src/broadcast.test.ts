/**
 * THE BROADCAST, WITH TOY HANDLERS — the three properties a door built on it
 * rests on, and no olai noun in the file.
 *
 * `@olai/plugin-api`'s bench holds the same three against the REAL doors (a
 * vault revision, the store going quiet, a conversation event). These are the
 * primitive's own, because a bus that lost its ordering or its containment would
 * fail there in three places at once and be diagnosed in none of them.
 */

import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Logger, Scope } from "effect"

import { broadcast } from "./broadcast.ts"
import { standing } from "./standing.ts"

test("every handler is told, in subscription order, and the caller waits", async () => {
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const run = standing()
  await run(bus.listen("one")((value) => Effect.sync(() => void said.push(`one:${value}`))))
  await run(bus.listen("other")((value) => Effect.sync(() => void said.push(`other:${value}`))))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["one:x", "other:x"])
})

for (const mode of ["effect", "throw"] as const) test(`a handler that fails by ${mode} is contained, and the ones after it still hear`, async () => {
  const said: Array<string> = []
  const lines: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const run = standing()
  // THE FAILING ONE FIRST: the failure this pins is a loop that stops, so a case
  // with it last would pass over a bus that contains nothing at all.
  await run(bus.listen("thrower")(() => {
    if (mode === "throw") throw new Error("nope")
    return Effect.die(new Error("nope"))
  }))
  await run(bus.listen("neighbour")(() => Effect.sync(() => void said.push("neighbour"))))
  const logger = Logger.make<unknown, void>(({ cause, message }) => {
    const words = (Array.isArray(message) ? message : [message]).map(String)
    if (cause.reasons.length > 0) words.push(String(Cause.squash(cause)))
    lines.push(words.join(" "))
  })
  // THE CALLER IS STILL STANDING, which is the half that matters most.
  await Effect.runPromise(bus.tell("x").pipe(Effect.provide(Logger.layer([logger]))))
  expect(said).toEqual(["neighbour"])
  // ...and the failure was said, with the registering plugin's word on it and
  // the occasion beside it.
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("thrower")
  expect(lines[0]).toContain("a toy occasion")
  expect(lines[0]).toContain("nope")
  expect(lines[0]).not.toContain("neighbour")
})

test("a handler leaves with the scope that registered it", async () => {
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const scope = Scope.makeUnsafe()
  await Effect.runPromise(
    Effect.provideService(
      bus.listen("leaver")(() => Effect.sync(() => void said.push("leaver"))),
      Scope.Scope,
      scope,
    ),
  )
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["leaver"])
  await Effect.runPromise(Scope.close(scope, Exit.void))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["leaver"])
})

test("a handler whose scope closes mid-dispatch is not called", async () => {
  // THE DISPATCH READS THE TABLE ONCE, so a handler that leaves while an
  // earlier one is parked is out of the table and still in the walk. What the
  // gate adds is that the walk reaching it does not CALL it — see `./gate.ts`.
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const run = standing()
  const entered = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  await run(bus.listen("first")(() =>
    Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(resume))))
  const leaving = Scope.makeUnsafe()
  await Effect.runPromise(Effect.provideService(
    bus.listen("leaver")(() => Effect.sync(() => void said.push("leaver"))),
    Scope.Scope,
    leaving,
  ))
  const telling = Effect.runPromise(bus.tell("x"))
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(Scope.close(leaving, Exit.void))
  await Effect.runPromise(Deferred.succeed(resume, undefined))
  await telling
  expect(said).toEqual([])
})

test("a publisher interrupted while a call is starting still takes that call with it", async () => {
  // THE HANDOFF, which is one step now and was two. `start` handed the fiber
  // back and the hold that would cut it was installed in a LATER step, so a
  // publisher interrupted between them left a root call running with nothing
  // left to stop it — reproduced through this bus as "publisher finished: true
  // handler unwound: false".
  //
  // The handler asks for its own publisher's interruption, which is the
  // narrowest way to land in that window: the request goes out from inside the
  // call, so the publisher is cut at the earliest moment it can be.
  const bus = broadcast<string>("a toy occasion")
  const run = standing()
  let publisher!: Fiber.Fiber<void>
  let unwound = false
  const resume = Deferred.makeUnsafe<void>()
  await run(bus.listen("subscriber")(() =>
    Effect.ensuring(
      Effect.gen(function*() {
        yield* Effect.sync(() => { Effect.runFork(Fiber.interrupt(publisher)) })
        yield* Deferred.await(resume)
      }),
      Effect.sync(() => { unwound = true }),
    )
  ))
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    publisher = yield* Effect.forkScoped(Effect.andThen(Effect.sleep("1 millis"), bus.tell("x")))
    yield* Effect.sleep("50 millis")
    expect(publisher.pollUnsafe()).not.toBeUndefined()
    expect(unwound).toBe(true)
    yield* Deferred.succeed(resume, undefined)
    yield* Fiber.await(publisher)
  })))
})

test("two handlers that are the same value are two registrations", async () => {
  // A `Map` keyed by a fresh symbol rather than a `Set`: dropping one must leave
  // the other, which a set keyed by the handler could not do.
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const same = (): Effect.Effect<void> => Effect.sync(() => void said.push("said"))
  const run = standing()
  await run(bus.listen("one")(same))
  await run(bus.listen("other")(same))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["said", "said"])
})
