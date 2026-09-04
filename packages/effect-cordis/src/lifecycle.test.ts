import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Scope } from "effect"
import { closeHost, mountPlugin, offered, openHost, provide, settled } from "./host.ts"
import { offer } from "./lifecycle.ts"
import { definePlugin, detached } from "./plugin.ts"
import { serviceTag } from "./service.ts"

const Resource = serviceTag<{ use: () => void }>("resource")
const Dependency = serviceTag<object>("dependency")
const run = (work: Effect.Effect<void, never, Scope.Scope>) => Effect.runPromise(Effect.scoped(work))

for (const fails of [false, true]) {
  test(`offered services stay pending until initialization ${fails ? "fails" : "succeeds"}`, () => run(Effect.gen(function*() {
    const host = yield* openHost
    const entered = Deferred.makeUnsafe<void>()
    const ready = Deferred.makeUnsafe<void>()
    let used = 0
    let alive = false
    const consumer = yield* mountPlugin(host, definePlugin({
      name: "consumer", needs: [Resource],
      apply: Effect.gen(function*() { (yield* Resource).use() }),
    }))
    const provider = yield* mountPlugin(host, definePlugin({
      name: "provider", needs: [], apply: Effect.gen(function*() {
        yield* Effect.acquireRelease(Effect.sync(() => { alive = true }), () => Effect.sync(() => { alive = false }))
        yield* offer(Resource, () => ({ use: () => { expect(alive).toBe(true); used++ } }))
        yield* Deferred.succeed(entered, undefined)
        yield* Deferred.await(ready)
        if (fails) yield* Effect.die(new Error("initialization failed"))
      }),
    }), { wait: false })
    yield* Deferred.await(entered)
    expect(yield* consumer.report).toEqual({ state: "waiting", missing: ["resource"] })
    expect(offered(host, Resource)).toBeUndefined()
    expect(used).toBe(0)
    yield* Deferred.succeed(ready, undefined)
    yield* settled(host, ["provider", "consumer"])
    expect(used).toBe(fails ? 0 : 1)
    expect(yield* provider.report).toEqual(fails ? { state: "failed", fault: "initialization failed" } : { state: "running" })
    if (fails) expect(alive).toBe(false)
  })))
}

for (const shutdown of [false, true]) {
  test(`dependent async cleanup uses a live provider during ${shutdown ? "host close" : "removal and replacement"}`, () => run(Effect.gen(function*() {
    const host = yield* openHost
    const order: string[] = []
    let generation = 0
    const provider = definePlugin({ name: "provider", needs: [], apply: Effect.gen(function*() {
      const id = ++generation
      let alive = true
      yield* Effect.addFinalizer(() => Effect.sync(() => { alive = false; order.push(`release ${id}`) }))
      yield* offer(Resource, () => ({ use: () => { order.push(`use ${id}: ${alive}`) } }))
      // A finalizer registered AFTER offer must still run after consumers.
      yield* Effect.addFinalizer(() => Effect.sync(() => { order.push(`last ${id}`) }))
    }) })
    const first = yield* mountPlugin(host, provider)
    yield* mountPlugin(host, definePlugin({ name: "consumer", needs: [Resource], apply: Effect.gen(function*() {
      const resource = yield* Resource
      yield* Effect.addFinalizer(() => Effect.gen(function*() {
        yield* Effect.sleep("10 millis")
        resource.use()
      }))
    }) }))
    if (shutdown) {
      yield* closeHost(host)
      yield* closeHost(host)
    } else {
      yield* first.dispose
      const second = yield* mountPlugin(host, provider)
      yield* settled(host, ["consumer"])
      yield* second.dispose
    }
    expect(order).toEqual(shutdown
      ? ["use 1: true", "last 1", "release 1"]
      : ["use 1: true", "last 1", "release 1", "use 2: true", "last 2", "release 2"])
  })))
}

for (const stop of ["explicit", "withdrawal", "host"] as const) {
  test(`a loading initializer is cancelled by ${stop}`, () => run(Effect.gen(function*() {
    const host = yield* openHost
    const dependency = Scope.makeUnsafe()
    yield* Scope.provide(dependency)(provide(host, Dependency, () => ({})))
    const entered = Deferred.makeUnsafe<void>()
    const background = Deferred.makeUnsafe<void>()
    const order: string[] = []
    let attempts = 0
    const consumer = yield* mountPlugin(host, definePlugin({ name: "consumer", needs: [Resource], apply: Effect.void }))
    const provider = yield* mountPlugin(host, definePlugin({ name: "provider", needs: [Dependency], apply: Effect.gen(function*() {
      attempts++
      yield* Effect.acquireRelease(Effect.sync(() => { order.push("acquire") }), () => Effect.gen(function*() {
        yield* Effect.sleep("10 millis")
        order.push("release")
      }))
      yield* offer(Resource, () => ({ use: () => {} }))
      const detach = yield* detached
      detach(Effect.gen(function*() {
        yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("background stopped") }))
        yield* Deferred.succeed(background, undefined)
        yield* Effect.never
      }).pipe(Effect.scoped))
      yield* Deferred.await(background)
      yield* Deferred.succeed(entered, undefined)
      if (attempts === 1) yield* Effect.never
    }) }), { wait: false })
    yield* Deferred.await(entered)
    expect(yield* consumer.report).toEqual({ state: "waiting", missing: ["resource"] })
    if (stop === "explicit") yield* provider.dispose
    if (stop === "host") yield* closeHost(host)
    if (stop === "withdrawal") yield* Scope.close(dependency, Exit.void)
    expect(order).toEqual(["acquire", "background stopped", "release"])
    expect(yield* provider.report).toEqual(stop === "withdrawal" ? { state: "waiting", missing: ["dependency"] } : { state: "off" })
    if (stop === "withdrawal") {
      yield* provide(host, Dependency, () => ({}))
      yield* settled(host, ["provider", "consumer"])
      expect(attempts).toBe(2)
      expect(order).toEqual(["acquire", "background stopped", "release", "acquire"])
      expect(yield* provider.report).toEqual({ state: "running" })
      expect(yield* consumer.report).toEqual({ state: "running" })
    }
  })))
}

for (const shutdown of [false, true]) {
  test(`loader ${shutdown ? "host close" : "flip"} cancels loading without rewriting its file`, () => run(Effect.gen(function*() {
    const { mkdtemp, writeFile, readFile, rm } = yield* Effect.promise(() => import("node:fs/promises"))
    const { tmpdir } = yield* Effect.promise(() => import("node:os"))
    const { pathToFileURL } = yield* Effect.promise(() => import("node:url"))
    const { mountRows, flipRow } = yield* Effect.promise(() => import("./loader.ts"))
    const dir = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(`${tmpdir()}/bridge-lifecycle-`)),
      (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
    )
    const path = `${dir}/plugins.yml`
    const source = "- id: loading\n  name: loading\n"
    yield* Effect.promise(() => writeFile(path, source))
    const host = yield* openHost
    const entered = Deferred.makeUnsafe<void>()
    let released = false
    const plugin = definePlugin({ name: "loading", needs: [], apply: Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.gen(function*() {
        yield* Effect.sleep("10 millis")
        released = true
      }))
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }) })
    yield* mountRows(host, { baseUrl: pathToFileURL(`${dir}/`).href, path: "plugins.yml", patches: [], resolve: async () => ({ default: plugin }) })
    yield* Deferred.await(entered)
    if (shutdown) yield* closeHost(host)
    else expect(yield* flipRow(host, "loading", true)).toBe(true)
    expect(released).toBe(true)
    expect(yield* Effect.promise(() => readFile(path, "utf8"))).toBe(source)
  })))
}

test("host close joins cleanup that already left the registry", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const cleaning = Deferred.makeUnsafe<void>()
  let released = false
  const mounted = yield* mountPlugin(host, definePlugin({ name: "departing", needs: [], apply: Effect.addFinalizer(() => Effect.gen(function*() {
    yield* Deferred.succeed(cleaning, undefined)
    yield* Effect.sleep("20 millis")
    released = true
  })) }))
  yield* mounted.dispose.pipe(Effect.forkScoped)
  yield* Deferred.await(cleaning)
  yield* closeHost(host)
  expect(released).toBe(true)
})))

test("host close interrupts active background work before resource release", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const entered = Deferred.makeUnsafe<void>()
  const order: string[] = []
  yield* mountPlugin(host, definePlugin({ name: "background", needs: [], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("resource released") }))
    const detach = yield* detached
    detach(Effect.gen(function*() {
      yield* Effect.addFinalizer(() => Effect.gen(function*() {
        yield* Effect.sleep("10 millis")
        order.push("background stopped")
      }))
      yield* Deferred.succeed(entered, undefined)
      yield* Effect.never
    }).pipe(Effect.scoped))
  }) }))
  yield* Deferred.await(entered)
  yield* closeHost(host)
  expect(order).toEqual(["background stopped", "resource released"])
})))

test("offer transfers its Cordis disposer out of the concurrent disposer set", () => run(Effect.gen(function*() {
  const { ctxOf } = yield* Effect.promise(() => import("./host.ts"))
  const { activate, Offering } = yield* Effect.promise(() => import("./lifecycle.ts"))
  const host = yield* openHost
  const ctx = ctxOf(host)
  const activation = activate(ctx, yield* Effect.context<never>())
  const before = [...ctx.fiber._disposables]
  yield* offer(Resource, () => ({ use: () => {} })).pipe(Effect.provideService(Offering, activation))
  expect([...ctx.fiber._disposables]).toEqual(before)
  expect(offered(host, Resource)).toBeDefined()
  yield* Effect.promise(() => activation.close(Exit.void))
  expect(offered(host, Resource)).toBeUndefined()
})))
