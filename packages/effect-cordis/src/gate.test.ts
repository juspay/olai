/**
 * THE GATE, WITH NO BUS UNDER IT — the four properties both dispatch modes rest
 * on, each asked of the primitive alone.
 *
 * `./broadcast.test.ts` asks the first two again through a real bus and
 * `./lifecycle.test.ts` asks them through two real plugins, which is where the
 * failure was reproduced. These are here because a gate that lost its
 * self-removal escape or its patience would hang a plugin's unload — and a hang
 * is diagnosed in whichever file has the fewest moving parts.
 */

import { expect, test } from "bun:test"
import { Cause, Deferred, type Duration, Effect, Exit, Logger, Scope } from "effect"

import { gate, type Gate } from "./gate.ts"

/** One gate, and the scope that holds it — kept apart because every case here
 *  is about what happens when that scope closes. */
const opened = async (
  patience?: Duration.Input,
): Promise<{ readonly gate: Gate; readonly close: () => Effect.Effect<void> }> => {
  const scope = Scope.makeUnsafe()
  const held = await Effect.runPromise(
    Effect.provideService(gate("one", "a toy occasion", patience), Scope.Scope, scope),
  )
  return { gate: held, close: () => Scope.close(scope, Exit.void) }
}

const beat = (): Promise<void> => new Promise((resume) => { setTimeout(resume, 20) })

test("a call that arrives after the scope closed takes the other arm", async () => {
  const { gate: shut, close } = await opened()
  let called = 0
  const call = shut.through(
    Effect.sync(() => { called += 1; return "called" as const }),
    Effect.succeed("skipped" as const),
  )
  expect(await Effect.runPromise(call)).toBe("called")
  expect(called).toBe(1)
  await Effect.runPromise(close())
  expect(await Effect.runPromise(call)).toBe("skipped")
  expect(called).toBe(1)
})

test("closing waits for a call that is already inside", async () => {
  const { gate: shut, close } = await opened()
  const said: Array<string> = []
  const entered = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  const call = Effect.runPromise(shut.through(
    Effect.gen(function*() {
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(resume)
      said.push("the call came out")
    }),
    Effect.void,
  ))
  await Effect.runPromise(Deferred.await(entered))
  const closing = Effect.runPromise(close()).then(() => void said.push("the scope closed"))
  // THE WHOLE CLAIM: the release is still standing there a beat later, with
  // nothing but the running call holding it.
  await beat()
  expect(said).toEqual([])
  await Effect.runPromise(Deferred.succeed(resume, undefined))
  await Promise.all([call, closing])
  expect(said).toEqual(["the call came out", "the scope closed"])
})

test("a call that closes the gate from inside is not waited for", async () => {
  // THE ONE ARRANGEMENT NO TIMER COULD SAVE: a handler that stops its own
  // plugin reaches the release on the fiber that is still inside the gate, so a
  // release that waited for everybody would be waiting for itself. This case
  // hangs rather than fails if that escape goes.
  const { gate: shut, close } = await opened()
  await Effect.runPromise(shut.through(close(), Effect.void))
  let called = 0
  await Effect.runPromise(shut.through(Effect.sync(() => { called += 1 }), Effect.void))
  expect(called).toBe(0)
})

test("a call that never comes out is given the patience and no more, and it is said", async () => {
  const { gate: shut, close } = await opened("20 millis")
  const entered = Deferred.makeUnsafe<void>()
  const release = Deferred.makeUnsafe<void>()
  const call = Effect.runPromise(shut.through(
    Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(release)),
    Effect.void,
  ))
  await Effect.runPromise(Deferred.await(entered))
  const lines: Array<string> = []
  const logger = Logger.make<unknown, void>(({ cause, message }) => {
    const words = (Array.isArray(message) ? message : [message]).map(String)
    if (cause.reasons.length > 0) words.push(String(Cause.squash(cause)))
    lines.push(words.join(" "))
  })
  await Effect.runPromise(close().pipe(Effect.provide(Logger.layer([logger]))))
  // ...and it is not silent about having given up: the plugin's word and the
  // occasion are both on the line, which is the whole of what a person reading
  // it has to go on.
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("one")
  expect(lines[0]).toContain("a toy occasion")
  await Effect.runPromise(Deferred.succeed(release, undefined))
  await call
})
