import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"

import { gate, type Gate, wasCut } from "./gate.ts"

const opened = async (): Promise<{
  readonly gate: Gate
  readonly close: () => Effect.Effect<void>
}> => {
  const scope = Scope.makeUnsafe()
  const held = await Effect.runPromise(
    Effect.provideService(gate(), Scope.Scope, scope),
  )
  return { gate: held, close: () => Scope.close(scope, Exit.void) }
}

const beat = (): Promise<void> => new Promise((resume) => { setTimeout(resume, 20) })

test("a call that arrives after the gate shut is never started", async () => {
  const { gate: shut, close } = await opened()
  let called = 0
  const call = shut.through(
    Effect.sync(() => { called += 1 }),
    (started) =>
      started === undefined
        ? Effect.succeed("skipped" as const)
        : Effect.as(Fiber.await(started), "started" as const),
  )
  expect(await Effect.runPromise(call)).toBe("started")
  expect(called).toBe(1)
  await Effect.runPromise(close())
  expect(await Effect.runPromise(call)).toBe("skipped")
  expect(called).toBe(1)
})

test("a call already inside is CUT, and the stop does not answer until it has unwound", async () => {
  const { gate: shut, close } = await opened()
  const said: Array<string> = []
  const entered = Deferred.makeUnsafe<void>()
  const held = Deferred.makeUnsafe<Fiber.Fiber<void>>()
  const calling = Effect.runPromise(shut.through(
    Effect.gen(function*() {
      yield* Effect.addFinalizer(() =>
        Effect.gen(function*() {
          yield* Effect.sleep("30 millis")
          said.push("the call finished unwinding")
        })
      )
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }).pipe(Effect.scoped),
    (started) =>
      Effect.andThen(Deferred.succeed(held, started!), Effect.asVoid(Fiber.await(started!))),
  ))
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(close())
  said.push("the gate stopped")
  await calling
  expect(said).toEqual(["the call finished unwinding", "the gate stopped"])
  expect(wasCut(await Effect.runPromise(Fiber.await(await Effect.runPromise(Deferred.await(held))))))
    .toBe(true)
})

for (const how of ["cut" , "left of its own accord"] as const) {
  test(`a call is out when its FIBER is, children and all — ${how}`, async () => {
    const { gate: shut, close } = await opened()
    const said: Array<string> = []
    const entered = Deferred.makeUnsafe<void>()
    const finish = Deferred.makeUnsafe<void>()
    const calling = Effect.runPromise(shut.through(
      Effect.gen(function*() {
        yield* Effect.forkChild(Effect.ensuring(
          Effect.andThen(Deferred.succeed(entered, undefined), Effect.never),
          Effect.gen(function*() {
            yield* Effect.sleep("40 millis")
            said.push("the child finished")
          }),
        ))
        if (how === "cut") yield* Effect.never
        else yield* Deferred.await(finish)
      }),
      (started) => Effect.asVoid(Fiber.await(started!)),
    ))
    await Effect.runPromise(Deferred.await(entered))
    if (how !== "cut") await Effect.runPromise(Deferred.succeed(finish, undefined))
    await Effect.runPromise(close())
    said.push("the gate stopped")
    await calling
    expect(said).toEqual(["the child finished", "the gate stopped"])
  })
}

test("cutting a call does not disturb the fiber that started it", async () => {
  const { gate: shut, close } = await opened()
  const entered = Deferred.makeUnsafe<void>()
  const said: Array<string> = []
  const calling = Effect.runPromise(shut.through(
    Effect.andThen(Deferred.succeed(entered, undefined), Effect.never),
    (started) =>
      Effect.gen(function*() {
        const exit = yield* Fiber.await(started!)
        said.push(wasCut(exit) ? "the call was cut" : "the call answered")
        said.push("the caller carried on")
      }),
  ))
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(close())
  await calling
  expect(said).toEqual(["the call was cut", "the caller carried on"])
})

test("a caller that DIES holding a call takes it with it too", async () => {
  const { gate: shut } = await opened()
  const entered = Deferred.makeUnsafe<void>()
  let released = false
  const dying = Effect.runPromiseExit(shut.through(
    Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.sync(() => { released = true }))
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }).pipe(Effect.scoped),
    () => { throw new Error("the caller came apart") },
  ))
  await Effect.runPromise(Deferred.await(entered))
  expect(Exit.isFailure(await dying)).toBe(true)
  await beat()
  expect(released).toBe(true)
})

test("a caller interrupted first takes its call with it", async () => {
  const { gate: shut } = await opened()
  const entered = Deferred.makeUnsafe<void>()
  let released = false
  const caller = Effect.runFork(shut.through(
    Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.sync(() => { released = true }))
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }).pipe(Effect.scoped),
    (started) => Effect.asVoid(Fiber.await(started!)),
  ))
  await Effect.runPromise(Deferred.await(entered))
  await Effect.runPromise(Fiber.interrupt(caller))
  await beat()
  expect(released).toBe(true)
})
