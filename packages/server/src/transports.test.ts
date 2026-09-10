import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Scope } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/unstable/http"
import { listener } from "./listener.ts"

// No known transport names: any scoped route provider can share the port.
test("independent route providers can leave and return without withdrawing another provider", async () => {
  await Effect.gen(function*() {
    const shared = yield* listener({ host: "127.0.0.1", port: 0 })
    const parent = yield* Effect.scope
    const one = yield* Scope.fork(parent)
    const two = yield* Scope.fork(parent)
    const route = (path: `/${string}`) => ({ routes: HttpRouter.add("GET", path, HttpServerResponse.text(path)) })
    yield* shared.register(route("/one")).pipe(Scope.provide(one))
    yield* shared.register(route("/two")).pipe(Scope.provide(two))
    const url = (yield* shared.start)!
    const status = (path: string) => Effect.promise(async () => (await fetch(url + path, { signal: AbortSignal.timeout(3000) })).status)
    expect(yield* status("/one")).toBe(200)
    expect(yield* status("/two")).toBe(200)
    yield* Scope.close(one, Exit.void)
    expect(yield* status("/one")).toBe(404)
    expect(yield* status("/two")).toBe(200)
    const again = yield* Scope.fork(parent)
    yield* shared.register(route("/one")).pipe(Scope.provide(again))
    expect(yield* status("/one")).toBe(200)
    yield* Scope.close(two, Exit.void)
    expect(yield* status("/one")).toBe(200)
    expect(yield* status("/two")).toBe(404)
    yield* Scope.close(again, Exit.void)
    yield* Effect.promise(async () => { await expect(fetch(url)).rejects.toThrow() })
    const last = yield* Scope.fork(parent)
    yield* shared.register(route("/three")).pipe(Scope.provide(last))
    expect(yield* status("/three")).toBe(200)
  }).pipe(Effect.scoped, Effect.runPromise)
})

test("an accepted HTTP request survives another provider arriving and leaving", async () => {
  await Effect.gen(function*() {
    const shared = yield* listener({ host: "127.0.0.1", port: 0 })
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    yield* shared.register({ routes: HttpRouter.add("GET", "/slow", Effect.gen(function*() {
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return HttpServerResponse.text("finished on its original request")
    })) })
    const url = (yield* shared.start)!
    const response = fetch(url + "/slow", { signal: AbortSignal.timeout(5000) })
      .then(async (reply) => ({ status: reply.status, text: await reply.text() }))
      .catch((error: unknown) => ({ status: 0, text: String(error) }))
    yield* Deferred.await(entered)
    const other = yield* Scope.fork(yield* Effect.scope)
    yield* shared.register({ routes: HttpRouter.add("GET", "/other", HttpServerResponse.text("other")) }).pipe(Scope.provide(other))
    yield* Scope.close(other, Exit.void)
    yield* Deferred.succeed(release, undefined)
    expect(yield* Effect.promise(() => response)).toEqual({ status: 200, text: "finished on its original request" })
  }).pipe(Effect.scoped, Effect.runPromise)
})
