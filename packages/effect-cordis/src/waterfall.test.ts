import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Scope } from "effect"

import { mountPlugin, openHost } from "./host.ts"
import { definePlugin, PluginName } from "./plugin.ts"
import { waterfall } from "./waterfall.ts"

interface Opening {
  readonly said: ReadonlyArray<string>
}

const Opening = waterfall<Opening>("opening")

const speaker = (name: string) =>
  definePlugin({
    name,
    needs: [Opening.key],
    apply: Effect.gen(function*() {
      const chain = yield* Opening.key
      const who = yield* PluginName
      yield* chain.use((value, next) =>
        Effect.suspend(() => next({ said: [...value.said, who] }))
      )
    }),
  })

const eagerSpeaker = (name: string) =>
  definePlugin({
    name,
    needs: [Opening.key],
    apply: Effect.gen(function*() {
      const chain = yield* Opening.key
      const who = yield* PluginName
      yield* chain.use((value, next) => next({ said: [...value.said, who] }))
    }),
  })

test("every mounted plugin sees one dispatch, in registration order", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(host, speaker("one"))
    yield* mountPlugin(host, speaker("other"))
    const opened = yield* dispatch({ said: [] })
    expect(opened.said).toEqual(["one", "other"])
  })))
})

test("a plugin that unloads is off the chain", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    const one = yield* mountPlugin(host, speaker("one"))
    yield* mountPlugin(host, speaker("other"))
    yield* one.dispose
    expect((yield* dispatch({ said: [] })).said).toEqual(["other"])
  })))
})

for (const [shape, make] of [["a suspended", speaker], ["an eager", eagerSpeaker]] as const) {
test(`a link whose plugin unloads mid-dispatch is skipped, and the chain carries on (${shape} body)`, async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    const entered = Deferred.makeUnsafe<void>()
    const resume = Deferred.makeUnsafe<void>()
    yield* mountPlugin(host, definePlugin({
      name: "slow",
      needs: [Opening.key],
      apply: Effect.gen(function*() {
        const chain = yield* Opening.key
        yield* chain.use((value, next) =>
          Effect.gen(function*() {
            yield* Deferred.succeed(entered, undefined)
            yield* Deferred.await(resume)
            return yield* next({ said: [...value.said, "slow"] })
          })
        )
      }),
    }))
    const leaving = yield* mountPlugin(host, make("leaver"))
    yield* mountPlugin(host, make("other"))
    const opening = yield* Effect.forkScoped(dispatch({ said: [] }))
    yield* Deferred.await(entered)
    yield* leaving.dispose
    yield* Deferred.succeed(resume, undefined)
    expect((yield* Fiber.join(opening)).said).toEqual(["slow", "other"])
  })))
})
}

for (const cutAt of ["before it asked", "after its answer came back", "while its answer was being worked out"] as const) {
  test(`a link cut ${cutAt} leaves the chain honest`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const host = yield* openHost
      const dispatch = yield* Opening.open(host)
      const parked = Deferred.makeUnsafe<void>()
      const released = Deferred.makeUnsafe<void>()
      let inner = 0
      const leaving = yield* mountPlugin(host, definePlugin({
        name: "leaver",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.gen(function*() {
              if (cutAt === "before it asked") {
                yield* Deferred.succeed(parked, undefined)
                yield* Effect.never
              }
              const carried = yield* next({ said: [...value.said, "leaver"] })
              if (cutAt === "after its answer came back") {
                yield* Deferred.succeed(parked, undefined)
                yield* Effect.never
              }
              return { said: [...carried.said, "leaver came out"] }
            })
          )
        }),
      }))
      yield* mountPlugin(host, definePlugin({
        name: "inner",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.gen(function*() {
              if (cutAt === "while its answer was being worked out") {
                yield* Deferred.succeed(parked, undefined)
                yield* Deferred.await(released)
              }
              const carried = yield* next({ said: [...value.said, "inner"] })
              inner += 1
              return carried
            })
          )
        }),
      }))
      const opening = yield* Effect.forkScoped(dispatch({ said: [] }))
      yield* Deferred.await(parked)
      yield* leaving.dispose
      if (cutAt === "while its answer was being worked out") {
        expect(inner).toBe(0)
        yield* Deferred.succeed(released, undefined)
      }
      const opened = yield* Fiber.join(opening)
      expect(inner).toBe(1)
      expect(opened.said).toEqual(cutAt === "before it asked"
        ? ["inner"]
        : [])
    })))
  })
}

for (const inflight of [false, true] as const) {
  test(`a child scope's withdrawal stops a link that is ${inflight ? "running" : "pending"}`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const host = yield* openHost
      const dispatch = yield* Opening.open(host)
      const parked = Deferred.makeUnsafe<void>()
      const resume = Deferred.makeUnsafe<void>()
      const child = Scope.makeUnsafe()
      let asked = 0
      if (!inflight) {
        yield* mountPlugin(host, definePlugin({
          name: "blocker",
          needs: [Opening.key],
          apply: Effect.gen(function*() {
            const chain = yield* Opening.key
            yield* chain.use((value, next) =>
              Effect.gen(function*() {
                yield* Deferred.succeed(parked, undefined)
                yield* Deferred.await(resume)
                return yield* next(value)
              })
            )
          }),
        }))
      }
      const owner = yield* mountPlugin(host, definePlugin({
        name: "leaver",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.gen(function*() {
              asked += 1
              if (inflight) {
                yield* Deferred.succeed(parked, undefined)
                yield* Effect.never
              }
              return yield* next({ said: [...value.said, "leaver"] })
            })
          ).pipe(Effect.provideService(Scope.Scope, child))
        }),
      }))
      yield* mountPlugin(host, speaker("other"))
      const opening = yield* Effect.forkScoped(dispatch({ said: [] }))
      yield* Deferred.await(parked)
      yield* Scope.close(child, Exit.void)
      if (!inflight) yield* Deferred.succeed(resume, undefined)
      const opened = yield* Fiber.join(opening)
      expect(asked).toBe(inflight ? 1 : 0)
      expect(opened.said).toEqual(["other"])
      expect(yield* owner.report).toEqual({ state: "running" })
    })))
  })
}

test("a middleware that dies is contained, and the rest of the chain runs", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(
      host,
      definePlugin({
        name: "broken",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use(() => Effect.die(new Error("nope")))
        }),
      }),
    )
    yield* mountPlugin(host, speaker("other"))
    expect((yield* dispatch({ said: [] })).said).toEqual(["other"])
  })))
})

test("a link that dies AFTER calling through does not re-ask the rest", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(
      host,
      definePlugin({
        name: "late",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value, next) =>
            Effect.flatMap(next(value), () => Effect.die(new Error("nope")))
          )
        }),
      }),
    )
    let asked = 0
    yield* mountPlugin(host, definePlugin({
      name: "other",
      needs: [Opening.key],
      apply: Effect.gen(function*() {
        const chain = yield* Opening.key
        yield* chain.use((value, next) =>
          Effect.suspend(() => {
            asked += 1
            return next(value)
          })
        )
      }),
    }))
    const opened = yield* dispatch({ said: [] })
    expect(asked).toBe(1)
    expect(opened.said).toEqual([])
  })))
})

test("a link may short-circuit the chain", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    yield* mountPlugin(
      host,
      definePlugin({
        name: "gate",
        needs: [Opening.key],
        apply: Effect.gen(function*() {
          const chain = yield* Opening.key
          yield* chain.use((value) => Effect.succeed({ said: [...value.said, "gate"] }))
        }),
      }),
    )
    yield* mountPlugin(host, speaker("never"))
    expect((yield* dispatch({ said: [] })).said).toEqual(["gate"])
  })))
})
