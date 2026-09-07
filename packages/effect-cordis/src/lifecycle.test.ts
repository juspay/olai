import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"
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

/** THE BUS THE TWO CASES BELOW RING — a service whose whole shape is one
 *  registration verb, which is what every real door in `@olai/plugin-api` hands
 *  a plugin and is the smallest thing that can carry the failure. */
const events = () => {
  const bus = broadcast<void>("a toy occasion")
  const key = serviceTag<{ readonly listen: ReturnType<typeof bus.listen> }>("toy-events")
  return { key, tell: bus.tell, open: (host: Host) => provide(host, key, (who) => ({ listen: bus.listen(who) })) }
}

test("a plugin that stops mid-dispatch is not called over its released resources", () => run(Effect.gen(function*() {
  // THE REPRODUCTION, kept: an event goes to two plugins, the first one parks,
  // and the second finishes stopping before its turn arrives. It used to be
  // told anyway, with its own finalizers already run — "second handler called;
  // resource alive = false".
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

/**
 * THE OTHER HALF, and the two reviewers' probe: a call that had already STARTED.
 *
 * The first version of this waited five seconds for such a call and then
 * released the resources underneath it, which is the reproduced defect with a
 * delay and a log line in front of it. It is CUT now — interrupted on the fiber
 * the gate started it on, joined before anything of the plugin's is released —
 * and these two cases are the whole of that claim: the handler's own cleanup
 * runs FIRST, and it never sees a released resource.
 *
 * BOTH REGISTRATION ORDERS, because the ordering was the second blocker. A
 * resource acquired AFTER the `listen` used to be released BEFORE the gate
 * stopped anything, and the tree really is written that way — `xyne-spaces`
 * registers its mirrors' stop after subscribing `onSeen`, deliberately, and
 * `git` forks four scoped loops after registering a revision handler. The stop
 * is the ACTIVATION's now, so where the `listen` sits among the resources does
 * not enter into it.
 */
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

/**
 * A LISTENER'S OWN SCOPE IS A LIFETIME OF ITS OWN, and giving the activation
 * the ordering may not take it away.
 *
 * `listen` and `use` are typed with `Scope`, and a plugin may register inside a
 * CHILD scope and close that child while staying mounted. The roster drops the
 * entry then — and for one round the gate stayed open, because registering with
 * the activation returned before a scope finalizer was added:
 *
 * ```text
 * child resource released
 * child scope closed; owner plugin still mounted
 * child handler called; alive=false
 * ```
 *
 * BOTH HALVES, because a withdrawal has two: one that has not been called yet
 * and one that is running.
 */
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
    // THE BLOCKER holds the dispatch open at the first handler, so the second
    // one is still ahead of the walk when its child scope closes.
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
      // RUNNING: cut where it stands, and the child's resource does not go
      // until it has.
      ? ["handler entered; resource alive = true", "child resource released", "child scope closed"]
      // PENDING: never called at all, though the walk still names it.
      : ["child resource released", "child scope closed"])
    // ...AND THE PLUGIN IS STILL MOUNTED THROUGHOUT, which is what makes this a
    // scope's withdrawal rather than an activation's.
    expect(yield* owner.report).toEqual({ state: "running" })
  })))
}

test("a gate's two owners join one cut rather than the second finding an empty set", () => run(Effect.gen(function*() {
  // A CHILD SCOPE AND THE ACTIVATION both reach the same stop. Whichever
  // arrives second must WAIT for the first: clearing the set and answering at
  // once would let a resource close beside a call that is still unwinding.
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
  // ONE unwind, and both owners behind it.
  expect(order.filter((one) => one === "handler unwound")).toHaveLength(1)
  expect(order.indexOf("handler unwound")).toBe(0)
  expect(order).toContain("child closed")
  expect(order).toContain("plugin stopped")
  expect(order.indexOf("handler unwound")).toBeLessThan(order.indexOf("plugin resource released"))
})))

/**
 * A DEPENDENT WAITING FOR A HANDLER MAY NOT BLOCK THE CUT THAT FINISHES IT.
 *
 * The stop's stages read as an order and one of them was in the wrong place: a
 * consumer whose finalizer joins an in-flight provider handler holds the
 * provider's revocation — the pinned `ctx.provide` disposer ends with
 * `Promise.allSettled(fibers.map(fiber => fiber.await()))`, so a revoke waits
 * for dependents too — and the revocation held the cut, which was the only
 * thing that could finish the handler. A cycle with no timer in it, and no
 * uninterruptible code anywhere.
 *
 * NOTHING RELEASES THE HANDLER IN THIS CASE. It parks on a `Deferred` this test
 * never completes, so the disposal either finishes because the cut reached it
 * or does not finish at all; the runner's own timeout is the only backstop and
 * the case is bounded so a failure cannot strand it.
 */
test("a plugin's stop waits for a handler's own child fibers, not just its body", () => run(Effect.gen(function*() {
  // THE SAME CLAIM AS `./gate.test.ts`'s, through a real plugin and a real
  // resource, because this is where it was reproduced: a handler that forks an
  // ordinary `Effect.forkChild` had that child's finalizer running over
  // released resources — `resource released` / `dispose completed` / `child
  // fiber cleanup; resource alive=false` — with nothing detached or unowned
  // anywhere in the handler.
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
  // A PLUGIN THAT SUBSCRIBES AND UNSUBSCRIBES IN A LOOP kept one closed record
  // per cycle for the rest of its life, because enrolling with the activation
  // only ever appended. The activation drops each record when the registration
  // says its own lifetime is over — which it does by settling a promise the
  // activation watches, rather than by anything a caller has to pass back.
  const host = yield* openHost
  const bus = events()
  yield* bus.open(host)
  const held: Array<WeakRef<object>> = []
  const owner = yield* mountPlugin(host, definePlugin({ name: "owner", needs: [bus.key], apply: Effect.gen(function*() {
    const activation = yield* Offering
    const enrol = activation!.quiet
    // WRAPPED WITHOUT CHANGING ANYTHING, which is the point: a wrapper that
    // forwards the call and nothing else must not be able to break the
    // pruning, and the first shape of this — a withdrawal handed back — could
    // be dropped by exactly this much instrumentation.
    Object.defineProperty(activation, "quiet", {
      value: (quieting: object) => {
        held.push(new WeakRef(quieting))
        enrol(quieting as never)
      },
    })
    const door = yield* bus.key
    // A HUNDRED, which is what the probe used and is not arbitrary: a handful
    // can be held alive by whichever frame the collector happens to see last,
    // and the claim here is about ACCUMULATION rather than about any one
    // record.
    for (let round = 0; round < 100; round += 1) {
      const child = Scope.makeUnsafe()
      yield* door.listen(() => Effect.void).pipe(Effect.provideService(Scope.Scope, child))
      yield* Scope.close(child, Exit.void)
    }
  }) }))
  // The prunes ride a promise, so they land a beat after the closes do.
  yield* Effect.sleep("20 millis")
  Bun.gc(true)
  yield* Effect.sleep("20 millis")
  Bun.gc(true)
  expect(held.filter((one) => one.deref() !== undefined)).toHaveLength(0)
  expect(yield* owner.report).toEqual({ state: "running" })
})), 20_000)

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
  // A REAL DISPOSER FIBER, which is the route a plugin actually takes: the
  // handler yields `dispose`, and `definePlugin`'s disposer closes the
  // activation on a fresh fiber. The first version had an identity escape that
  // could not reach this route, so it fell through to the five-second wait; a
  // cut has no such hole — the handler's await of its own stop is interrupted,
  // the stop completes, and neither has to know about the other.
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
  // NOT FIVE SECONDS, which is what the arrangement this replaced cost: the
  // handler is cut where it stands rather than waited out, so the dispatch is
  // free the moment its last handler has unwound.
  expect(Date.now() - started).toBeLessThan(2_000)
  expect(order).toEqual([
    "handler asked for its own removal",
    "handler unwound",
    "the dispatch answered",
  ])
  // ...AND THE STOP THE HANDLER ASKED FOR STILL HAPPENS. It is the same
  // disposal — `dispose` is one promise however many times it is asked — and
  // its resource release lands after the handler had already left, which is the
  // whole invariant.
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
  // TWO SEPARATE `definePlugin` CALLS. Cordis keys a runtime by the identity of
  // the `apply` it was handed, so a second row spread off the first would be
  // the same runtime under a second name — and would report the first name for
  // both, which is the very thing this case is reading.
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
  // THE WORDING ITSELF, verbatim: a pin bump that rewords the refusal fails
  // here, beside the match it breaks, rather than one package over inside a
  // sentence that would still read plausibly.
  expect((conflict as OfferConflict).message).toBe(
    "service \"resource\" has been registered at <first-provider>",
  )
  // ...and the refusal cost the first provider nothing.
  expect((yield* first.report).state).toBe("running")
  expect((yield* second.report).state).toBe("running")
  expect(offered(host, Resource)).toBeDefined()
})))

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
