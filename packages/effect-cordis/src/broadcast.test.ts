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
import { Cause, Effect, Exit, Logger, Scope } from "effect"

import { broadcast } from "./broadcast.ts"

/** Run a scoped effect against a scope this case owns. */
const held = () => {
  const scope = Scope.makeUnsafe()
  return <A>(work: Effect.Effect<A, never, Scope.Scope>): Promise<A> =>
    Effect.runPromise(Effect.provideService(work, Scope.Scope, scope))
}

test("every handler is told, in subscription order, and the caller waits", async () => {
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const run = held()
  await run(bus.listen("one")((value) => Effect.sync(() => void said.push(`one:${value}`))))
  await run(bus.listen("other")((value) => Effect.sync(() => void said.push(`other:${value}`))))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["one:x", "other:x"])
})

test("a handler that dies is contained, and the ones after it still hear", async () => {
  const said: Array<string> = []
  const lines: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const run = held()
  // THE FAILING ONE FIRST: the failure this pins is a loop that stops, so a case
  // with it last would pass over a bus that contains nothing at all.
  await run(bus.listen("thrower")(() => Effect.die(new Error("nope"))))
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

test("two handlers that are the same value are two registrations", async () => {
  // A `Map` keyed by a fresh symbol rather than a `Set`: dropping one must leave
  // the other, which a set keyed by the handler could not do.
  const said: Array<string> = []
  const bus = broadcast<string>("a toy occasion")
  const same = (): Effect.Effect<void> => Effect.sync(() => void said.push("said"))
  const run = held()
  await run(bus.listen("one")(same))
  await run(bus.listen("other")(same))
  await Effect.runPromise(bus.tell("x"))
  expect(said).toEqual(["said", "said"])
})
