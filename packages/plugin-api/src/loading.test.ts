import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber } from "effect"
import { definePlugin, mountPlugin, openHost, settled } from "@olai/effect-cordis"
import { HostLoading, openLoading, type OwnedLoader } from "./loading.ts"

const metadata = { services: () => [], browserServices: () => [] }

test("a loader's owner drains children and catalogs, and retained loaders cannot mount", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const catalog = yield* openLoading(host, ["reserved"], () => {}, metadata)
    let held: OwnedLoader | undefined
    let acquired = 0
    let released = 0
    const child = definePlugin({ name: "child", needs: [], apply: Effect.gen(function*() {
      acquired++
      yield* Effect.addFinalizer(() => Effect.sync(() => { released++ }))
    }) })
    const owner = definePlugin({ name: "owner", needs: [HostLoading], apply: Effect.gen(function*() {
      const loading = yield* HostLoading
      held = yield* loading.acquire
      yield* loading.describe({ names: () => ["child"], rows: () => [], set: () => Effect.succeed(false) })
      yield* held.mount(child)
    }) })
    const first = yield* mountPlugin(host, owner)
    yield* settled(host, ["child"])
    const stale = held!
    expect(acquired).toBe(1)
    expect(catalog.names()).toEqual(["child"])
    const reservation = yield* Effect.exit(stale.mount(definePlugin({ name: "reserved", needs: [], apply: Effect.void })))
    expect(Exit.isFailure(reservation)).toBe(true)
    yield* first.dispose
    expect(released).toBe(1)
    expect(catalog.names()).toEqual([])
    expect(Exit.isFailure(yield* Effect.exit(stale.mount(child)))).toBe(true)
    const second = yield* mountPlugin(host, owner)
    yield* settled(host, ["child"])
    expect(acquired).toBe(2)
    expect(held).not.toBe(stale)
    yield* first.dispose
    expect(released).toBe(1)
    yield* second.dispose
    expect(released).toBe(2)
  })))
})

test("owner disposal waits for child cleanup and interrupts an acquiring child", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* openLoading(host, [], () => {}, metadata)
    const began = yield* Deferred.make<void>()
    const cleanup = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [HostLoading], apply: Effect.gen(function*() {
      const loader = yield* (yield* HostLoading).acquire
      yield* loader.mount(definePlugin({ name: "pending", needs: [], apply: Effect.gen(function*() {
        yield* Effect.addFinalizer(() => Effect.andThen(Deferred.succeed(cleanup, undefined), Deferred.await(release)))
        yield* Deferred.succeed(began, undefined)
        yield* Effect.never
      }) }))
    }) }))
    yield* Deferred.await(began)
    let stopped = false
    const dropping = yield* Effect.forkChild(Effect.andThen(owner.dispose, Effect.sync(() => { stopped = true })))
    yield* Deferred.await(cleanup)
    expect(stopped).toBe(false)
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(dropping)
  })))
})
