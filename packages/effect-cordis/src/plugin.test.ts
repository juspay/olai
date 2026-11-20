import { expect, test } from "bun:test"
import { Cause, Effect, Fiber, Logger, Schema, Scope } from "effect"

import { definePlugin, detached, PluginName } from "./plugin.ts"
import { mountPlugin, openHost, provide, settled } from "./host.ts"
import { offer } from "./lifecycle.ts"
import { serviceTag } from "./service.ts"

interface Ledger {
  readonly write: (line: string) => Effect.Effect<void>
}
const Ledger = serviceTag<Ledger>("ledger")

interface Counter {
  readonly bump: Effect.Effect<void>
}
const Counter = serviceTag<Counter>("counter")

const ledgerOf = (lines: Array<string>) => (plugin: string): Ledger => ({
  write: (line) => Effect.sync(() => void lines.push(`${plugin}: ${line}`)),
})

test("a plugin waits for the service it names, and starts when one arrives", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const plugin = definePlugin({
      name: "scribe",
      needs: [Ledger],
      apply: Effect.gen(function*() {
        const ledger = yield* Ledger
        yield* ledger.write("applied")
      }),
    })
    const mounted = yield* mountPlugin(host, plugin)
    expect(yield* mounted.report).toEqual({ state: "waiting", missing: ["ledger"] })
    expect(lines).toEqual([])

    yield* provide(host, Ledger, ledgerOf(lines))
    yield* Effect.sleep("10 millis")
    expect(yield* mounted.report).toEqual({ state: "running" })
    expect(lines).toEqual(["scribe: applied"])
  })))
})

test("the stamp is the fiber's, and a plugin cannot spell another's", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    for (const name of ["one", "other"]) {
      yield* mountPlugin(
        host,
        definePlugin({
          name,
          needs: [Ledger],
          apply: Effect.gen(function*() {
            const ledger = yield* Ledger
            yield* ledger.write(yield* PluginName)
          }),
        }),
      )
    }
    expect(lines).toEqual(["one: one", "other: other"])
  })))
})

test("finalizers run in reverse when the plugin unloads", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    const mounted = yield* mountPlugin(
      host,
      definePlugin({
        name: "scribe",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const ledger = yield* Ledger
          yield* Effect.acquireRelease(ledger.write("first up"), () => ledger.write("first down"))
          yield* Effect.acquireRelease(ledger.write("second up"), () => ledger.write("second down"))
        }),
      }),
    )
    expect(lines).toEqual(["scribe: first up", "scribe: second up"])
    yield* mounted.dispose
    expect(lines).toEqual([
      "scribe: first up",
      "scribe: second up",
      "scribe: second down",
      "scribe: first down",
    ])
  })))
})

test("a replaced provider unloads the plugin and applies it again", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const plugin = definePlugin({
      name: "scribe",
      needs: [Ledger],
      apply: Effect.gen(function*() {
        const ledger = yield* Ledger
        yield* Effect.acquireRelease(ledger.write("up"), () => ledger.write("down"))
      }),
    })
    yield* Effect.scoped(Effect.gen(function*() {
      yield* provide(host, Ledger, ledgerOf(lines))
      yield* mountPlugin(host, plugin)
      expect(lines).toEqual(["scribe: up"])
    }))
    yield* Effect.sleep("10 millis")
    expect(lines).toEqual(["scribe: up", "scribe: down"])
    yield* provide(host, Ledger, ledgerOf(lines))
    yield* Effect.sleep("10 millis")
    expect(lines).toEqual(["scribe: up", "scribe: down", "scribe: up"])
  })))
})

test("host scope closes a plugin that names no service", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* mountPlugin(
      host,
      definePlugin({
        name: "hermit",
        needs: [],
        apply: Effect.gen(function*() {
          lines.push("hermit: up")
          yield* Effect.addFinalizer(() => Effect.sync(() => void lines.push("hermit: down")))
        }),
      }),
    )
    expect(lines).toEqual(["hermit: up"])
    yield* Effect.scoped(provide(host, Ledger, ledgerOf(lines)))
    yield* Effect.sleep("10 millis")
    expect(lines).toEqual(["hermit: up"])
  })))
  expect(lines).toEqual(["hermit: up", "hermit: down"])
})

test("a plugin whose Effect dies lands failed, having installed nothing", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    yield* provide(host, Counter, () => ({ bump: Effect.void }))
    const broken = yield* mountPlugin(
      host,
      definePlugin({
        name: "broken",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const ledger = yield* Ledger
          yield* Effect.acquireRelease(ledger.write("up"), () => ledger.write("down"))
          return yield* Effect.die(new Error("the socket is not there"))
        }),
      }),
    )
    const sibling = yield* mountPlugin(
      host,
      definePlugin({
        name: "sibling",
        needs: [Counter],
        apply: Effect.gen(function*() {
          yield* (yield* Counter).bump
        }),
      }),
    )
    expect(yield* broken.report).toEqual({
      state: "failed",
      fault: "the socket is not there",
    })
    expect(lines).toEqual(["broken: up", "broken: down"])
    expect(yield* sibling.report).toEqual({ state: "running" })
  })))
})

test("a finalizer that dies on the way out does not steal the plugin's fault", async () => {
  const said: Array<string> = []
  const collector = Logger.make<unknown, void>(({ message }) => {
    said.push(Array.isArray(message) ? message.map(String).join(" ") : String(message))
  })
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf([]))
    const broken = yield* mountPlugin(
      host,
      definePlugin({
        name: "broken",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          yield* Effect.addFinalizer(() => Effect.die(new Error("the disk went away")))
          return yield* Effect.die(new Error("the socket is not there"))
        }),
      }),
    )
    expect(yield* broken.report).toEqual({
      state: "failed",
      fault: "the socket is not there",
    })
  })).pipe(Effect.provide(Logger.layer([collector]))))
  expect(said.some((line) => line.includes("unwinding after a failed start"))).toBe(true)
  expect(said.some((line) => line.includes(`"broken"`))).toBe(true)
})

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
  test(`a start that fails while ${how} still reports the plugin's own words`, async () => {
    const restore = lose()
    try {
      await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
        const host = yield* openHost
        const broken = yield* mountPlugin(
          host,
          definePlugin({
            name: "broken",
            needs: [],
            apply: Effect.die(new Error("the socket is not there")),
          }),
        )
        expect(yield* broken.report).toEqual({
          state: "failed",
          fault: "the socket is not there",
        })
      })).pipe(Effect.provide(Logger.layer([]))))
    } finally {
      restore()
    }
  })
}

test("a defect in detached work is said, with the plugin's word on it", async () => {
  const said: Array<string> = []
  const collector = Logger.make<unknown, void>(({ message, cause }) => {
    const line = Array.isArray(message) ? message.map(String).join(" ") : String(message)
    said.push(cause === undefined ? line : `${line} ${String(Cause.squash(cause))}`)
  })
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf([]))
    yield* mountPlugin(
      host,
      definePlugin({
        name: "scribe",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const run = yield* detached
          run(Effect.die(new Error("the watcher threw")))
        }),
      }),
    )
    yield* Effect.sleep("10 millis")
  })).pipe(Effect.provide(Logger.layer([collector]))))
  const detachedLine = said.find((line) => line.includes("detached work"))
  expect(detachedLine).toBeDefined()
  expect(detachedLine).toContain(`"scribe"`)
  expect(detachedLine).toContain("the watcher threw")
})

test("detached work handed back as a fiber keeps the plugin's lifetime and its word", async () => {
  const said: Array<string> = []
  const collector = Logger.make<unknown, void>(({ message, cause }) => {
    const line = Array.isArray(message) ? message.map(String).join(" ") : String(message)
    said.push(cause === undefined ? line : `${line} ${String(Cause.squash(cause))}`)
  })
  const order: Array<string> = []
  let held!: Fiber.Fiber<void>
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf([]))
    const mounted = yield* mountPlugin(
      host,
      definePlugin({
        name: "scribe",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const run = yield* detached
          run.held(Effect.die(new Error("the held work threw")))
          held = run.held(Effect.gen(function*() {
            yield* Effect.addFinalizer(() => Effect.sync(() => { order.push("held work stopped") }))
            yield* Effect.never
          }).pipe(Effect.scoped))
        }),
      }),
    )
    yield* Effect.sleep("10 millis")
    yield* mounted.dispose
    yield* Fiber.await(held)
    order.push("the plugin stopped")
  })).pipe(Effect.provide(Logger.layer([collector]))))
  expect(order).toEqual(["held work stopped", "the plugin stopped"])
  const line = said.find((one) => one.includes("detached work"))
  expect(line).toContain(`"scribe"`)
  expect(line).toContain("the held work threw")
})

test("a scope a plugin opened is closed by the disposer, not by the fiber", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    const mounted = yield* mountPlugin(
      host,
      definePlugin({
        name: "scribe",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const ledger = yield* Ledger
          const scope = yield* Effect.scope
          yield* Scope.addFinalizer(scope, ledger.write("closed"))
        }),
      }),
    )
    expect(lines).toEqual([])
    yield* mounted.dispose
    expect(lines).toEqual(["scribe: closed"])
  })))
})

test("a plugin behind a key another names is running once the mounts have settled", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    const consumer = yield* mountPlugin(
      host,
      definePlugin({
        name: "consumer",
        needs: [Counter],
        apply: Effect.gen(function*() {
          const counter = yield* Counter
          yield* Effect.sleep("5 millis")
          yield* counter.bump
        }),
      }),
    )
    expect(yield* consumer.report).toEqual({ state: "waiting", missing: ["counter"] })

    const provider = yield* mountPlugin(
      host,
      definePlugin({
        name: "provider",
        needs: [Ledger],
        apply: Effect.gen(function*() {
          const ledger = yield* Ledger
          yield* Effect.sleep("5 millis")
          yield* offer(Counter, () => ({ bump: ledger.write("bumped") }))
        }),
      }),
    )
    expect(yield* provider.report).toEqual({ state: "running" })
    expect(yield* consumer.report).toEqual({ state: "waiting" })
    expect(lines).toEqual([])

    yield* settled(host, ["provider", "consumer"])
    expect(yield* consumer.report).toEqual({ state: "running" })
    expect(lines).toEqual(["provider: bumped"])
  })))
})

test("a provider that unloads takes its dependents with it, and brings them back", async () => {
  const lines: Array<string> = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Ledger, ledgerOf(lines))
    const provider = definePlugin({
      name: "provider",
      needs: [Ledger],
      apply: Effect.gen(function*() {
        const ledger = yield* Ledger
        yield* offer(Counter, () => ({ bump: ledger.write("bumped") }))
      }),
    })
    const dependent = definePlugin({
      name: "dependent",
      needs: [Counter],
      apply: Effect.gen(function*() {
        yield* Counter
        yield* Effect.sleep("5 millis")
        lines.push("dependent: up")
        yield* Effect.addFinalizer(() => Effect.sync(() => void lines.push("dependent: down")))
      }),
    })

    const first = yield* mountPlugin(host, provider)
    yield* mountPlugin(host, dependent)
    expect(lines).toEqual(["dependent: up"])

    yield* first.dispose
    yield* settled(host, ["provider", "dependent"])
    expect(lines).toEqual(["dependent: up", "dependent: down"])

    yield* mountPlugin(host, provider)
    yield* settled(host, ["provider", "dependent"])
    expect(lines).toEqual(["dependent: up", "dependent: down", "dependent: up"])
  })))
})

test("a plugin with Config is handed the decoded value, and invalid config fails with a sentence", async () => {
  let seen: unknown
  const configSchema = Schema.Struct({
    commit: Schema.Literals(["off", "manual", "auto"]).pipe(
      Schema.withDecodingDefaultKey(Effect.succeed("manual" as const)),
      Schema.annotate({ description: "when a write is recorded" }),
    ),
  })
  const plugin = definePlugin({
    name: "scribe",
    needs: [],
    config: configSchema,
    configUpdates: "live",
    apply: (config) => Effect.sync(() => {
      seen = config
    }),
  })
  expect(plugin.config).toBe(configSchema)
  expect(plugin.configUpdates).toBe("live")
  expect(seen).toBeUndefined()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* mountPlugin(host, plugin)
  })))
  expect(seen).toEqual({ commit: "manual" })

  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const valid = yield* mountPlugin(host, plugin, { config: { commit: "auto" } })
    expect(seen).toEqual({ commit: "auto" })
    yield* valid.dispose
    const invalid = yield* mountPlugin(host, plugin, { config: { commit: "nope" } })
    const report = yield* invalid.report
    expect(report.state).toBe("failed")
    expect(report.state === "failed" ? report.fault : undefined).toContain("auto")
    expect(seen).toEqual({ commit: "auto" })
  })))
})

test("secrets and machine paths arrive through a keyed provision, never config options", async () => {
  const Resource = serviceTag<{ token: string; executable: string }>("resource")
  const options: unknown[] = []
  let consumer = ""
  let received: unknown
  const plugin = definePlugin({
    name: "reader",
    environment: [{ key: "TOKEN", secret: true, says: "credential" }, { key: "EXECUTABLE", secret: false, says: "machine path" }],
    needs: [Resource],
    config: Schema.Struct({
      mode: Schema.String.pipe(
        Schema.withDecodingDefaultKey(Effect.succeed("quiet")),
        Schema.annotate({ description: "how much to report" }),
      ),
    }),
    apply: (config) => Effect.gen(function*() {
      received = { config, resource: yield* Resource }
    }),
  })
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* provide(host, Resource, (who) => {
      consumer = who
      return { token: "fixture-secret", executable: "/fixture/bin/tool" }
    })
    yield* mountPlugin(host, {
      ...plugin,
      apply: (ctx, config) => {
        options.push(config)
        return plugin.apply(ctx, config)
      },
    }, { config: { mode: "verbose" } })
  })))
  expect(consumer).toBe("reader")
  expect(options).toEqual([{ mode: "verbose" }])
  expect(JSON.stringify(plugin.environment)).not.toContain("fixture-secret")
  expect(JSON.stringify(plugin.environment)).not.toContain("/fixture/bin/tool")
  expect(received).toEqual({ config: { mode: "verbose" }, resource: { token: "fixture-secret", executable: "/fixture/bin/tool" } })
  expect(Schema.decodeUnknownSync(plugin.config!)({})).toEqual({ mode: "quiet" })
})



for (const failure of ["provision", "initialization"]) {
  test(`a consumer lifetime is revoked after failed ${failure}`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const host = yield* openHost
      let current = () => false
      yield* provide(host, Ledger, (_plugin, lifetime) => {
        current = lifetime!.current
        expect(current()).toBe(true)
        if (failure === "provision") throw new Error("no ledger")
        return { write: () => Effect.void }
      })
      const mounted = yield* mountPlugin(host, definePlugin({
        name: "scribe", needs: [Ledger], apply: Effect.die(new Error("no scribe")),
      }))
      expect((yield* mounted.report).state).toBe("failed")
      expect(current()).toBe(false)
    })))
  })
}
