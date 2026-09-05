import { expect, test } from "bun:test"
import { Effect, Exit, Scope } from "effect"
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
