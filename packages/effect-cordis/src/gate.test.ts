/**
 * THE GATE, WITH NO BUS UNDER IT — the properties both dispatch modes rest on,
 * asked of the primitive alone.
 *
 * `./broadcast.test.ts` asks them again through a real bus,
 * `./waterfall.test.ts` through a real chain, and `./lifecycle.test.ts` through
 * real plugins with real resources — which is where the failures were
 * reproduced and where the ORDERING claim can be made at all, since the
 * ordering is the activation's and a bare scope has none.
 *
 * These are here because a gate that stopped cutting, or started cutting
 * without joining, would fail there in several places and be diagnosed in none
 * of them.
 *
 * ONE PROPERTY IS NOT HERE AND CANNOT BE: that a gate's two owners — a child
 * scope closing and the activation's pre-close stage — join the SAME cut rather
 * than the second finding an empty set. A bare scope has one owner, and closing
 * it twice tests `Scope.close`'s own idempotence and not this module's. It is
 * asked in `./lifecycle.test.ts`, where both owners exist.
 */

import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"

import { gate, type Gate, wasCut } from "./gate.ts"

/** One gate on a BARE scope, which is also the shape a child scope takes. The
 *  activation path is `./lifecycle.test.ts`'s. */
const opened = async (): Promise<{
  readonly gate: Gate
  readonly close: () => Effect.Effect<void>
}> => {
  const scope = Scope.makeUnsafe()
  const held = await Effect.runPromise(
    Effect.provideService(gate("one", "a toy occasion"), Scope.Scope, scope),
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
  // THE WHOLE OF WHAT REPLACED THE TIMER. The old release waited five seconds
  // and then let the resources close under a handler that was still running;
  // this one interrupts the call and does not come back until that call has
  // finished its own cleanup.
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
  // THE ORDER IS THE CLAIM: unwound first, stopped second. A cut that only
  // SIGNALLED would put these the other way round.
  expect(said).toEqual(["the call finished unwinding", "the gate stopped"])
  expect(wasCut(await Effect.runPromise(Fiber.await(await Effect.runPromise(Deferred.await(held))))))
    .toBe(true)
})

for (const how of ["cut" , "left of its own accord"] as const) {
  test(`a call is out when its FIBER is, children and all — ${how}`, async () => {
    // THE BODY'S LAST LINE IS NOT THE FIBER'S EXIT, and for a round this module
    // confused them: the record was settled by an `ensuring` around the handler
    // body, which runs BEFORE the fiber interrupts and joins its own children.
    // A handler that forks an ordinary `Effect.forkChild` with a finalizer of
    // its own therefore had that finalizer running after the stop had answered
    // — with nothing detached or unowned anywhere in it.
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
    // THE CHILD FIRST, whichever way the call ended. A stop that answered on
    // the body alone would put these the other way round.
    expect(said).toEqual(["the child finished", "the gate stopped"])
  })
}

test("cutting a call does not disturb the fiber that started it", async () => {
  // The publisher's own fiber is what a handler used to run on, which is why
  // the first version could not cut anything. It holds the call now instead:
  // the cut lands on the call's own fiber and the caller walks on.
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

test("a caller interrupted first takes its call with it", async () => {
  // The started fiber is a ROOT and not a child, which is what makes the
  // shut-check and the start one synchronous block. The hold `through`
  // installs — inside the same uninterruptible step as the start — is where
  // that price is paid back.
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
