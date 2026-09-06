/**
 * `POST /olai/resync` on a real listener. The store-side claim (same-length
 * rewrite, refresh misses, resync publishes) is `@olai/store`'s; this file
 * is the door: loopback POST returns 204, and a GET is not that door.
 */

import { Deferred, Effect, Fiber, Result } from "effect"
import { NO_DIRECTORY } from "@olai/ops"
import { expect, test } from "bun:test"

import { served, withServing } from "./serve.testlib.ts"
import { RESYNC_PATH, resyncDirectory } from "olai-plugin-vault/testlib"

const BOUND_MS = 10_000

test("POST /olai/resync returns 204, and a GET is not that answer", async () => {
  const root = served()
  await withServing({ root }, async (url) => {
    const posted = await fetch(`${url}${RESYNC_PATH}`, { method: "POST" })
    expect(posted.status).toBe(204)
    const got = await fetch(`${url}${RESYNC_PATH}`)
    expect(got.status).not.toBe(204)
  })
}, BOUND_MS)

for (const change of ["directory", "gate", "both", "neither"] as const) {
  test(`resync keeps one provider while waiting: ${change} changes`, () => Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const waiting = yield* Deferred.make<void>()
    const finish = yield* Deferred.make<void>()
    let refreshed = 0
    const store = { refresh: () => Effect.sync(() => { refreshed++ }) }
    let directory = { store }
    let gate = { idle: Effect.andThen(Deferred.succeed(waiting, undefined), Deferred.await(finish)) }
    const result = yield* Effect.forkScoped(Effect.result(resyncDirectory(() => directory, () => gate)))
    yield* Deferred.await(waiting)
    if (change === "directory" || change === "both") directory = { store }
    if (change === "gate" || change === "both") gate = { idle: Effect.void }
    yield* Deferred.succeed(finish, undefined)
    expect(yield* Fiber.join(result)).toEqual(change === "neither" ? Result.succeed(undefined) : Result.fail(NO_DIRECTORY))
    expect(refreshed).toBe(change === "neither" ? 1 : 0)
  }))))
}
