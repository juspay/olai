import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Scope } from "effect"
import { broadcast } from "./broadcast.ts"
import { closeHost, type Host, mountPlugin, offered, openHost, provide, settled } from "./host.ts"
import { offer, OfferConflict, Offering } from "./lifecycle.ts"
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

test("a loader config patch that the plugin refuses lands failed and the patch completes", () => run(Effect.gen(function*() {
  const { mkdtemp, writeFile, readFile, rm } = yield* Effect.promise(() => import("node:fs/promises"))
  const { tmpdir } = yield* Effect.promise(() => import("node:os"))
  const { pathToFileURL } = yield* Effect.promise(() => import("node:url"))
  const { mountRows, patchRow } = yield* Effect.promise(() => import("./loader.ts"))
  const { rowReport } = yield* Effect.promise(() => import("./host.ts"))
  const { Schema } = yield* Effect.promise(() => import("effect"))
  const dir = yield* Effect.acquireRelease(
    Effect.promise(() => mkdtemp(`${tmpdir()}/bridge-config-`)),
    (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
  )
  const path = `${dir}/plugins.yml`
  const source = "- id: scribe\n  name: scribe\n"
  yield* Effect.promise(() => writeFile(path, source))
  const host = yield* openHost
  const seen: string[] = []
  const plugin = definePlugin({
    name: "scribe", needs: [],
    config: Schema.Struct({ commit: Schema.Literals(["manual", "auto"]) }),
    apply: (config) => Effect.sync(() => { seen.push(config.commit) }),
  })
  yield* mountRows(host, { baseUrl: pathToFileURL(`${dir}/`).href, path: "plugins.yml", patches: [{ id: "scribe", config: { commit: "manual" } }], resolve: async () => ({ default: plugin }) })
  yield* settled(host, ["scribe"])
  expect(yield* patchRow(host, "scribe", { config: { commit: "nope" } })).toBe(true)
  yield* settled(host, ["scribe"])
  const refused = (yield* rowReport(host, ["scribe"])).get("scribe")
  expect(refused?.state).toBe("failed")
  expect(yield* patchRow(host, "scribe", { config: { commit: "auto" } })).toBe(true)
  yield* settled(host, ["scribe"])
  expect((yield* rowReport(host, ["scribe"])).get("scribe")).toEqual({ state: "running" })
  expect(seen).toEqual(["manual", "auto"])
  expect(yield* Effect.promise(() => readFile(path, "utf8"))).toBe(source)
})))

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

const events = () => {
  const bus = broadcast<void>("a toy occasion")
  const key = serviceTag<{ readonly listen: ReturnType<typeof bus.listen> }>("toy-events")
  return { key, tell: bus.tell, open: (host: Host) => provide(host, key, (who) => ({ listen: bus.listen(who) })) }
}

test("a plugin that stops mid-dispatch is not called over its released resources", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const entered = Deferred.makeUnsafe<void>()
  const resume = Deferred.makeUnsafe<void>()
  const order: string[] = []
  yield* mountPlugin(host, definePlugin({ name: "first", needs: [bus.key], apply: Effect.gen(function*() {
    yield* (yield* bus.key).listen(() => Effect.gen(function*() {
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(resume)
    }))
  }) }))
  const second = yield* mountPlugin(host, definePlugin({ name: "second", needs: [bus.key], apply: Effect.gen(function*() {
    let alive = true
    yield* Effect.addFinalizer(() => Effect.sync(() => { alive = false; order.push("second released") }))
    yield* (yield* bus.key).listen(() => Effect.sync(() => { order.push(`second told, alive = ${alive}`) }))
  }) }))
  const telling = yield* Effect.forkScoped(bus.tell(undefined))
  yield* Deferred.await(entered)
  yield* second.dispose
  order.push("second stopped")
  yield* Deferred.succeed(resume, undefined)
  yield* Fiber.join(telling)
  expect(order).toEqual(["second released", "second stopped"])
})))

for (const when of ["before the listen", "after the listen"] as const) {
  test(`a running handler is cut and joined before a resource registered ${when} is released`, () => run(Effect.gen(function*() {
    const host = yield* openHost
    const bus = events()
    yield* bus.open(host)
    const entered = Deferred.makeUnsafe<void>()
    const order: string[] = []
    let alive = true
    const resource = Effect.addFinalizer(() =>
      Effect.sync(() => { alive = false; order.push("resource released") })
    )
    const only = yield* mountPlugin(host, definePlugin({ name: "only", needs: [bus.key], apply: Effect.gen(function*() {
      if (when === "before the listen") yield* resource
      yield* (yield* bus.key).listen(() =>
        Effect.gen(function*() {
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => { order.push(`handler unwound; resource alive = ${alive}`) })
          )
          yield* Deferred.succeed(entered, undefined)
          yield* Effect.never
        }).pipe(Effect.scoped)
      )
      if (when === "after the listen") yield* resource
    }) }))
    const telling = yield* Effect.forkScoped(bus.tell(undefined))
    yield* Deferred.await(entered)
    yield* only.dispose
    order.push("dispose completed")
    yield* Fiber.join(telling)
    expect(order).toEqual([
      "handler unwound; resource alive = true",
      "resource released",
      "dispose completed",
    ])
  })))
}

for (const inflight of [false, true] as const) {
  test(`a child scope's withdrawal stops a handler that is ${inflight ? "running" : "pending"}, with its plugin still mounted`, () => run(Effect.gen(function*() {
    const host = yield* openHost
    const bus = events()
    yield* bus.open(host)
    const entered = Deferred.makeUnsafe<void>()
    const parked = Deferred.makeUnsafe<void>()
    const order: string[] = []
    let alive = true
    const child = Scope.makeUnsafe()
    if (!inflight) {
      yield* mountPlugin(host, definePlugin({ name: "blocker", needs: [bus.key], apply: Effect.gen(function*() {
        yield* (yield* bus.key).listen(() =>
          Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(parked))
        )
      }) }))
    }
    const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [bus.key], apply: Effect.gen(function*() {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => { alive = false; order.push("child resource released") })
      ).pipe(Effect.provideService(Scope.Scope, child))
      yield* (yield* bus.key).listen(() =>
        Effect.gen(function*() {
          order.push(`handler entered; resource alive = ${alive}`)
          if (inflight) {
            yield* Deferred.succeed(entered, undefined)
            yield* Effect.never
          }
        })
      ).pipe(Effect.provideService(Scope.Scope, child))
    }) }))
    const telling = yield* Effect.forkScoped(bus.tell(undefined))
    yield* Deferred.await(entered)
    yield* Scope.close(child, Exit.void)
    order.push("child scope closed")
    if (!inflight) yield* Deferred.succeed(parked, undefined)
    yield* Fiber.join(telling)
    expect(order).toEqual(inflight
      ? ["handler entered; resource alive = true", "child resource released", "child scope closed"]
      : ["child resource released", "child scope closed"])
    expect(yield* owner.report).toEqual({ state: "running" })
  })))
}

test("a gate's two owners join one cut rather than the second finding an empty set", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const entered = Deferred.makeUnsafe<void>()
  const order: string[] = []
  const child = Scope.makeUnsafe()
  const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [bus.key], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("plugin resource released") }))
    yield* (yield* bus.key).listen(() =>
      Effect.gen(function*() {
        yield* Effect.addFinalizer(() =>
          Effect.gen(function*() {
            yield* Effect.sleep("50 millis")
            order.push("handler unwound")
          })
        )
        yield* Deferred.succeed(entered, undefined)
        yield* Effect.never
      }).pipe(Effect.scoped)
    ).pipe(Effect.provideService(Scope.Scope, child))
  }) }))
  const telling = yield* Effect.forkScoped(bus.tell(undefined))
  yield* Deferred.await(entered)
  const closing = yield* Effect.forkScoped(
    Effect.andThen(Scope.close(child, Exit.void), Effect.sync(() => order.push("child closed")))
  )
  const stopping = yield* Effect.forkScoped(
    Effect.andThen(owner.dispose, Effect.sync(() => order.push("plugin stopped")))
  )
  yield* Fiber.join(telling)
  yield* Fiber.join(closing)
  yield* Fiber.join(stopping)
  expect(order.filter((one) => one === "handler unwound")).toHaveLength(1)
  expect(order.indexOf("handler unwound")).toBe(0)
  expect(order).toContain("child closed")
  expect(order).toContain("plugin stopped")
  expect(order.indexOf("handler unwound")).toBeLessThan(order.indexOf("plugin resource released"))
})))

test("a plugin's stop waits for a handler's own child fibers, not just its body", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const entered = Deferred.makeUnsafe<void>()
  const order: string[] = []
  let alive = true
  const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [bus.key], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { alive = false; order.push("resource released") }))
    yield* (yield* bus.key).listen(() =>
      Effect.gen(function*() {
        yield* Effect.forkChild(Effect.ensuring(
          Effect.andThen(Deferred.succeed(entered, undefined), Effect.never),
          Effect.gen(function*() {
            yield* Effect.sleep("40 millis")
            order.push(`the child unwound; resource alive = ${alive}`)
          }),
        ))
        yield* Effect.never
      })
    )
  }) }))
  const telling = yield* Effect.forkScoped(bus.tell(undefined))
  yield* Deferred.await(entered)
  yield* owner.dispose
  order.push("dispose completed")
  yield* Fiber.join(telling)
  expect(order).toEqual([
    "the child unwound; resource alive = true",
    "resource released",
    "dispose completed",
  ])
})), 20_000)

test("a registration whose scope ends stops being one of the activation's", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const shuts: Array<{ readonly closed: boolean; shut: number }> = []
  const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [bus.key], apply: Effect.gen(function*() {
    const activation = yield* Offering
    const enrol = activation!.quiet
    let closing = true
    Object.defineProperty(activation, "quiet", {
      value: (quieting: { readonly shut: () => void; readonly done: Promise<void> }) => {
        const counted = { closed: closing, shut: 0 }
        shuts.push(counted)
        enrol({
          ...quieting,
          shut: () => { counted.shut += 1; quieting.shut() },
        } as never)
      },
    })
    const door = yield* bus.key
    for (let round = 0; round < 5; round += 1) {
      const child = Scope.makeUnsafe()
      yield* door.listen(() => Effect.void).pipe(Effect.provideService(Scope.Scope, child))
      yield* Scope.close(child, Exit.void)
    }
    closing = false
    yield* door.listen(() => Effect.void)
  }) }))
  yield* Effect.sleep("20 millis")
  yield* owner.dispose
  expect(shuts.filter((one) => one.closed).map((one) => one.shut)).toEqual([0, 0, 0, 0, 0])
  expect(shuts.filter((one) => !one.closed).map((one) => one.shut)).toEqual([1])
})))

test("a dependent's cleanup waiting on a provider's handler does not block the cut", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const entered = Deferred.makeUnsafe<void>()
  const unwound = Deferred.makeUnsafe<void>()
  const held = Deferred.makeUnsafe<void>()
  const order: string[] = []
  const provider = yield* mountPlugin(host, definePlugin({ name: "provider", needs: [bus.key], apply: Effect.gen(function*() {
    yield* offer(Resource, () => ({ use: () => {} }))
    yield* (yield* bus.key).listen(() =>
      Effect.ensuring(
        Effect.andThen(Deferred.succeed(entered, undefined), Deferred.await(held)),
        Effect.andThen(
          Effect.sync(() => order.push("handler unwound")),
          Deferred.succeed(unwound, undefined),
        ),
      )
    )
  }) }))
  yield* mountPlugin(host, definePlugin({ name: "consumer", needs: [Resource], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() =>
      Effect.gen(function*() {
        order.push("consumer awaits the handler")
        yield* Deferred.await(unwound)
        order.push("consumer released")
      })
    )
  }) }))
  const telling = yield* Effect.forkScoped(bus.tell(undefined))
  yield* Deferred.await(entered)
  yield* provider.dispose
  order.push("provider stopped")
  yield* Fiber.join(telling)
  expect(order).toEqual([
    "handler unwound",
    "consumer awaits the handler",
    "consumer released",
    "provider stopped",
  ])
})), 20_000)

test("a handler that stops its own plugin is cut rather than waited for", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const order: string[] = []
  let stopping!: Effect.Effect<void>
  const only = yield* mountPlugin(host, definePlugin({ name: "only", needs: [bus.key], apply: Effect.gen(function*() {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("resource released") }))
    yield* (yield* bus.key).listen(() =>
      Effect.gen(function*() {
        yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("handler unwound") }))
        order.push("handler asked for its own removal")
        yield* stopping
        order.push("the handler came back from its own removal")
      }).pipe(Effect.scoped)
    )
  }) }))
  stopping = only.dispose
  const started = Date.now()
  yield* bus.tell(undefined)
  order.push("the dispatch answered")
  expect(Date.now() - started).toBeLessThan(2_000)
  expect(order).toEqual([
    "handler asked for its own removal",
    "handler unwound",
    "the dispatch answered",
  ])
  yield* only.dispose
  expect(order).toEqual([
    "handler asked for its own removal",
    "handler unwound",
    "the dispatch answered",
    "resource released",
  ])
})))

test("a second offer of one key is an OfferConflict naming the first provider", () => run(Effect.gen(function*() {
  const host = yield* openHost
  const refused: Array<unknown> = []
  const first = yield* mountPlugin(host, definePlugin({
    name: "first-provider", needs: [], apply: offer(Resource, () => ({ use: () => {} })),
  }))
  const second = yield* mountPlugin(host, definePlugin({
    name: "second-provider", needs: [], apply: Effect.gen(function*() {
      refused.push(yield* Effect.catchDefect(
        offer(Resource, () => ({ use: () => {} })),
        (defect) => Effect.succeed(defect),
      ))
    }),
  }))
  const conflict = refused[0]
  expect(conflict).toBeInstanceOf(OfferConflict)
  expect((conflict as OfferConflict).owner).toBe("first-provider")
  expect((conflict as OfferConflict).key).toBe("resource")
  expect((conflict as OfferConflict).message).toBe(
    "service \"resource\" has been registered at <first-provider>",
  )
  expect((yield* first.report).state).toBe("running")
  expect((yield* second.report).state).toBe("running")
  expect(offered(host, Resource)).toBeDefined()
})))

const STACKLESS = [
  ["the stack trace limit is 0", () => {
    const limit = Error.stackTraceLimit
    Error.stackTraceLimit = 0
    return () => { Error.stackTraceLimit = limit }
  }],
  ["no error has a stack at any limit", () => {
    const errors = Error as unknown as { prepareStackTrace?: unknown }
    const prepare = errors.prepareStackTrace
    errors.prepareStackTrace = () => undefined
    return () => { errors.prepareStackTrace = prepare }
  }],
] as const

for (const [how, lose] of STACKLESS) {
  test(`a duplicate offer is still an OfferConflict while ${how}`, async () => {
    const restore = lose()
    try {
      await run(Effect.gen(function*() {
        const host = yield* openHost
        const refused: Array<unknown> = []
        yield* mountPlugin(host, definePlugin({
          name: "first-provider", needs: [], apply: offer(Resource, () => ({ use: () => {} })),
        }))
        yield* mountPlugin(host, definePlugin({
          name: "second-provider", needs: [], apply: Effect.gen(function*() {
            refused.push(yield* Effect.catchDefect(
              offer(Resource, () => ({ use: () => {} })),
              (defect) => Effect.succeed(defect),
            ))
          }),
        }))
        expect(refused[0]).toBeInstanceOf(OfferConflict)
        expect((refused[0] as OfferConflict).owner).toBe("first-provider")
        expect((refused[0] as OfferConflict).key).toBe("resource")
      }))
    } finally {
      restore()
    }
  })

  test(`a duplicate root provision is an OfferConflict while ${how}`, async () => {
    const restore = lose()
    try {
      await run(Effect.gen(function*() {
        const host = yield* openHost
        yield* mountPlugin(host, definePlugin({
          name: "first-provider", needs: [], apply: offer(Resource, () => ({ use: () => {} })),
        }))
        const exit = yield* Effect.exit(Scope.provide(yield* Scope.make())(provide(host, Resource, () => ({ use: () => {} }))))
        const defect = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
        expect(defect).toBeInstanceOf(OfferConflict)
        expect((defect as OfferConflict).owner).toBe("first-provider")
      }))
    } finally {
      restore()
    }
  })
}

test("an unhandled duplicate offer fails only the row that offered second", () => run(Effect.gen(function*() {
  const host = yield* openHost
  yield* mountPlugin(host, definePlugin({
    name: "first-provider", needs: [], apply: offer(Resource, () => ({ use: () => {} })),
  }))
  const second = yield* mountPlugin(host, definePlugin({
    name: "second-provider", needs: [], apply: offer(Resource, () => ({ use: () => {} })),
  }))
  expect(yield* second.report).toEqual({
    state: "failed",
    fault: "service \"resource\" has been registered at <first-provider>",
  })
  expect(offered(host, Resource)).toBeDefined()
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
