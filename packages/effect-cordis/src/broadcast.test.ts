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
  await Effect.runPromise(bus.tell("x").pipe(Effect.provide(Logger.layer([logger]))))
  expect(said).toEqual(["neighbour"])
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
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const same = (): Effect.Effect<void> => Effect.sync(() => void said.push("said"))
  const run = standing()
  await run(bus.listen("one")(same))
  await run(bus.listen("other")(same))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["said", "said"])
})
