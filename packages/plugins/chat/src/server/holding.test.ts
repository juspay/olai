import { expect, test } from "bun:test"
import { Deferred, Effect, Stream } from "effect"
import { holding } from "./holding.ts"

test("the wire hold acknowledges registration and releases with its subscriber", async () => {
  let acquired = 0
  let released = 0
  const to = { agent: "alpha", session: "remembered" }
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const acknowledged = yield* Deferred.make<void>()
    const source = holding(Effect.succeed({
      holding: address => Effect.acquireRelease(
        Effect.sync(() => { expect(address).toEqual(to); acquired++ }),
        () => Effect.sync(() => { released++ }),
      ),
    }))
    yield* Effect.forkScoped(Stream.runForEach(source.source(to), value => {
      expect(value).toBeNull()
      return Deferred.succeed(acknowledged, undefined)
    }))
    yield* Deferred.await(acknowledged)
    expect(acquired).toBe(1)
    expect(released).toBe(0)
  })))
  expect(released).toBe(1)
})
