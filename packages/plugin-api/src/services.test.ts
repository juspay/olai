import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Fiber, Layer, Logger, Queue, type Scope, Stream, SubscriptionRef } from "effect"

import {
  ConfigurationSource,
  ConfigurationWatch,
  Deliveries,
  LocalState,
  Ledger,
  SERVICE_KEYS,
  definePlugin,
  Kinds,
  type Mounted,
  mountPlugin,
  Offers,

  Ops,
  type PluginsConfig,
  SessionStart,
  serviceTag,
  Surfaces,
  Vault,
  vaultEvents,
  type VaultSnapshot,
  Wakes,
  Watching,
} from "./services.ts"
import type { Configuration } from "./configuration.ts"

const NOTHING_FOUND = { server: null, missing: null }

const snapshotOf = (said: string, rev = 1): VaultSnapshot =>
  ({ rev, value: {} as VaultSnapshot["value"], changed: [said], removed: [] })

const saidIn = (snapshot: VaultSnapshot): string => snapshot.changed[0] ?? ""

const NOTHING = { surface: { spec: {} }, faces: {}, deps: {} }

const WAKING = {
  subject: "terminal activity",
  from: "terminals from",
  waiting: { one: "line", many: "lines" },
  walks: "nodes" as const,
  faults: { gone: "the file left", unwatchable: "not an outline" },
}

const collector = (): { readonly layer: Layer.Layer<never>; readonly said: Array<string> } => {
  const said: Array<string> = []
  const logger = Logger.make<unknown, void>(({ cause, logLevel, message }) => {
    if (logLevel !== "Warn") return
    const words = (Array.isArray(message) ? message : [message]).map(String)
    if (cause.reasons.length > 0) words.push(String(Cause.squash(cause)))
    said.push(words.join(" "))
  })
  return { layer: Logger.layer([logger]), said }
}

const runtime = (config: Partial<PluginsConfig> = {}) =>
  openPlugins({
    vars: {},
    now: () => "2026-09-02T00:00:00.000Z",
    served: "/tmp/x",
    ...config,
  })

const registering = (name: string) =>
  definePlugin({
    name,
    needs: [Surfaces],
    apply: Effect.gen(function*() {
      yield* (yield* Surfaces).register(NOTHING)
    }),
  })

test("a sibling the composition root refused leaves the table, and takes only its own plugin down", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen: Array<number> = []
    const table: { composed: () => ReadonlyArray<{ readonly name: string }> } = { composed: () => [] }
    const opened = yield* runtime({
      changed: () => {
        seen.push(table.composed().length)
        if (table.composed().some((one) => one.name === "bad")) {
          throw new Error("re-compose refuses bad")
        }
      },
    })
    table.composed = opened.composed

    const good = yield* mountPlugin(opened.host, registering("good"))
    const bad = yield* mountPlugin(opened.host, registering("bad"))
    const later = yield* mountPlugin(opened.host, registering("later"))

    expect(opened.composed().map((one) => one.name)).toEqual(["good", "later"])

    expect([
      (yield* good.report).state,
      (yield* bad.report).state,
      (yield* later.report).state,
    ]).toEqual(["running", "failed", "running"])

    expect(seen.length).toBeGreaterThanOrEqual(3)
  })))
})

test("an unloaded plugin's sibling leaves the table too", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const mounted = yield* mountPlugin(plugins.host, registering("kolu"))
    expect(plugins.composed().map((one) => one.name)).toEqual(["kolu"])
    yield* mounted.dispose
    expect(plugins.composed()).toEqual([])
  })))
})

test("a kind refused for collision leaves the first plugin's word standing and adds none", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const kind = { kind: "terminal", takes: "a terminal", admits: () => true }
    const teaching = (name: string) =>
      definePlugin({
        name,
        needs: [Kinds],
        apply: Effect.gen(function*() {
          yield* (yield* Kinds).register(kind)
        }),
      })
    const first = yield* mountPlugin(plugins.host, teaching("kolu"))
    const second = yield* mountPlugin(plugins.host, teaching("kolu"))

    expect([...plugins.kinds().keys()]).toEqual(["kolu-terminal"])
    expect([(yield* first.report).state, (yield* second.report).state]).toEqual([
      "running",
      "failed",
    ])
  })))
})
const collecting = (asked: Array<{ readonly name: string }>) =>
  definePlugin({
    name: "chat",
    needs: [Offers],
    apply: Effect.gen(function*() {
      yield* (yield* Offers).offer(SessionStart, (plugin) => ({
        ask: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              asked.push({ name: plugin })
            }),
            () =>
              Effect.sync(() => {
                const at = asked.findIndex((one) => one.name === plugin)
                if (at >= 0) asked.splice(at, 1)
              }),
          ),
      }))
    }),
  })

test("what a plugin asks is on the list, under the name its fiber was bound with", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const asked: Array<{ readonly name: string }> = []
    yield* mountPlugin(plugins.host, collecting(asked))
    const order: Array<string> = []
    const asking = (name: string, slow: boolean) =>
      definePlugin({
        name,
        needs: [SessionStart],
        apply: Effect.gen(function*() {
          if (slow) yield* Effect.yieldNow
          order.push(name)
          yield* (yield* SessionStart).ask(Effect.succeed(NOTHING_FOUND))
        }),
      })
    yield* mountPlugin(plugins.host, asking("prompt", false))
    yield* mountPlugin(plugins.host, asking("slow", true))

    expect(asked.map((one) => one.name)).toEqual(["prompt", "slow"])
    expect(order).toEqual(["prompt", "slow"])
  })))
})

test("an unloaded plugin is off the next session's list", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const asked: Array<{ readonly name: string }> = []
    yield* mountPlugin(plugins.host, collecting(asked))
    const mounted = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "kolu",
        needs: [SessionStart],
        apply: Effect.gen(function*() {
          yield* (yield* SessionStart).ask(Effect.succeed(NOTHING_FOUND))
        }),
      }),
    )
    expect(asked.map((one) => one.name)).toEqual(["kolu"])
    yield* mounted.dispose
    expect(asked).toEqual([])
  })))
})

test("a vault listener that dies costs the next plugin nothing", async () => {
  const heard: Array<string> = []
  const { layer, said } = collector()
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      yield* mountPlugin(
        plugins.host,
        definePlugin({
          name: "thrower",
          needs: [Vault],
          apply: Effect.gen(function*() {
            yield* (yield* Vault).revision(() =>
              Effect.die(new Error("a walk this plugin could not finish"))
            )
          }),
        }),
      )
      yield* mountPlugin(
        plugins.host,
        definePlugin({
          name: "neighbour",
          needs: [Vault],
          apply: Effect.gen(function*() {
            yield* (yield* Vault).revision(() => Effect.sync(() => void heard.push("neighbour")))
          }),
        }),
      )

      yield* plugins.published(snapshotOf("one"))
    })).pipe(Effect.provide(layer)),
  )
  expect(heard).toEqual(["neighbour"])
  expect(said).toHaveLength(1)
  expect(said[0]).toContain("thrower")
  expect(said[0]).toContain("a walk this plugin could not finish")
  expect(said[0]).not.toContain("neighbour")
})

test("an unloaded listener that dies costs the next plugin nothing", async () => {
  const heard: Array<string> = []
  const { layer, said } = collector()
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      yield* mountPlugin(
        plugins.host,
        definePlugin({
          name: "thrower",
          needs: [Vault],
          apply: Effect.gen(function*() {
            yield* (yield* Vault).unloaded(Effect.die(new Error("nope")))
          }),
        }),
      )
      yield* mountPlugin(
        plugins.host,
        definePlugin({
          name: "neighbour",
          needs: [Vault],
          apply: Effect.gen(function*() {
            yield* (yield* Vault).unloaded(Effect.sync(() => void heard.push("neighbour")))
          }),
        }),
      )
      yield* plugins.quiet
    })).pipe(Effect.provide(layer)),
  )
  expect(heard).toEqual(["neighbour"])
  expect(said[0]).toContain("thrower")
})

test("a vault listener goes when its plugin does", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const heard: Array<string> = []
    const plugins = yield* runtime()
    const mounted = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "leaver",
        needs: [Vault],
        apply: Effect.gen(function*() {
          yield* (yield* Vault).revision(() => Effect.sync(() => void heard.push("leaver")))
        }),
      }),
    )
    yield* plugins.published(snapshotOf("one"))
    expect(heard).toEqual(["leaver"])
    yield* mounted.dispose
    yield* plugins.published(snapshotOf("two", 2))
    expect(heard).toEqual(["leaver"])
  })))
})

test("the doorbell's door is keyed by the plugin, with no way to spell another's", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const asked: Array<string> = []
    const plugins = yield* runtime()
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "chat",
        needs: [Offers],
        apply: Effect.gen(function*() {
          yield* (yield* Offers).offer(Deliveries, (plugin) => {
            asked.push(plugin)
            return {
              scopes: () => [{ agent: "a", session: "s", pick: `${plugin}.olai`, current: () => true }],

              deliver: () => Effect.void,
              notify: () => Effect.void,
            }
          })
        }),
      }),
    )
    const seen: Array<string> = []
    const looking = (name: string) =>
      definePlugin({
        name,
        needs: [Deliveries],
        apply: Effect.gen(function*() {
          for (const scope of (yield* Deliveries).scopes()) seen.push(String(scope.pick))
        }),
      })
    yield* mountPlugin(plugins.host, looking("kolu"))
    yield* mountPlugin(plugins.host, looking("odu"))
    expect(seen).toEqual(["kolu.olai", "odu.olai"])
    expect(asked).toEqual(["kolu", "odu"])
  })))
})

test("a plugin's local-state door is one door, however many times it is used", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    let minted = 0
    const plugins = yield* runtime({
      localStateFor: () => {
        minted += 1
        let record: Record<string, unknown> | null = null
        return {
          load: Effect.sync(() => record),
          save: (value) => Effect.sync(() => void (record = value)),
          directory: Effect.fail({ _tag: "StateFailure", why: "unused here" }),
        }
      },
    })
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "spaces",
        needs: [LocalState],
        apply: Effect.gen(function*() {
          const localState = yield* LocalState
          yield* Effect.orDie(localState.save({ queue: ["B"] }))
          yield* Effect.orDie(localState.save({ queue: [] }))
          expect(yield* localState.load).toEqual({ queue: [] })
        }),
      }),
    )
    expect(minted).toBe(1)
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "other",
        needs: [LocalState],
        apply: Effect.gen(function*() {
          expect(yield* (yield* LocalState).load).toBeNull()
        }),
      }),
    )
    expect(minted).toBe(2)
  })))
})

test("a plugin that comes back writes down the chain it was already writing down", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    let minted = 0
    const plugins = yield* runtime({
      localStateFor: () => {
        minted += 1
        let record: Record<string, unknown> | null = null
        return {
          load: Effect.sync(() => record),
          save: (value) => Effect.sync(() => void (record = value)),
          directory: Effect.fail({ _tag: "StateFailure", why: "unused here" }),
        }
      },
    })
    const spaces = definePlugin({
      name: "spaces",
      needs: [LocalState],
      apply: Effect.gen(function*() {
        yield* Effect.orDie((yield* LocalState).save({ queue: ["B"] }))
      }),
    })
    const first = yield* mountPlugin(plugins.host, spaces)
    yield* first.dispose
    const again = yield* mountPlugin(plugins.host, spaces)
    expect((yield* again.report).state).toBe("running")
    expect(minted).toBe(1)
  })))
})

test("what a plugin reads off wakes is what is declared right now, not what was", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const ringing = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "kolu",
        needs: [Wakes],
        apply: Effect.gen(function*() {
          yield* (yield* Wakes).register(WAKING)
        }),
      }),
    )
    let asking: Effect.Effect<ReadonlyMap<string, unknown>> = Effect.succeed(new Map())
    let current: () => ReadonlyMap<string, unknown> = () => new Map()
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "chat",
        needs: [Wakes],
        apply: Effect.gen(function*() {
          const wakes = yield* Wakes
          asking = wakes.declared
          current = wakes.current
        }),
      }),
    )
    expect([...(yield* asking).keys()]).toEqual(["kolu"])
    expect([...current().keys()]).toEqual(["kolu"])
    const first = current().get("kolu")
    yield* ringing.dispose
    expect([...(yield* asking).keys()]).toEqual([])
    expect([...current().keys()]).toEqual([])
    yield* mountPlugin(plugins.host, definePlugin({
      name: "kolu", needs: [Wakes], apply: Effect.gen(function*() {
        yield* (yield* Wakes).register(WAKING)
      }),
    }))
    expect(current().get("kolu")).not.toBe(first)
    expect(current().get("kolu")).toBe((yield* asking).get("kolu"))
  })))
})

const rowOf = (mounted: Mounted) =>
  Effect.map(mounted.report, (report) => [
    report.state,
    report.state === "failed" ? report.fault ?? "" : "",
  ] as const)

test("a refused write reaches every plugin watching writes, and stops when one leaves", async () => {
  const heard: Array<{ readonly who: string; readonly op: string; readonly tag: string; readonly writer: string }> = []
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      const watching = (name: string) =>
        definePlugin({
          name,
          needs: [Ops],
          apply: Effect.gen(function*() {
            yield* (yield* Ops).refused((refusal) =>
              Effect.sync(() => {
                heard.push({ who: name, op: refusal.op, tag: refusal.failure._tag, writer: refusal.writer })
              })
            )
          }),
        })
      const mirror = yield* mountPlugin(plugins.host, watching("mirror"))
      yield* mountPlugin(plugins.host, watching("panel"))

      yield* plugins.refused({ op: "prop", failure: { _tag: "UsageFailure" }, writer: "web" })
      expect(heard).toEqual([
        { who: "mirror", op: "prop", tag: "UsageFailure", writer: "web" },
        { who: "panel", op: "prop", tag: "UsageFailure", writer: "web" },
      ])

      heard.length = 0
      yield* mirror.dispose
      yield* plugins.refused({ op: "trash", failure: { _tag: "ValidationFailure" }, writer: "chat-agent" })
      expect(heard).toEqual([{ who: "panel", op: "trash", tag: "ValidationFailure", writer: "chat-agent" }])
    })),
  )
})

test("a plugin that offers a door core keeps is refused, and only that plugin falls over", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const greedy = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "kolu",
        needs: [Offers],
        apply: Effect.gen(function*() {
          const offers = yield* Offers
          const past = offers.offer as unknown as (
            key: unknown,
            door: unknown,
          ) => Effect.Effect<void, never, Scope.Scope>
          yield* past(Kinds, () => ({ register: () => Effect.void }))
        }),
      }),
    )
    const [state, fault] = yield* rowOf(greedy)
    expect(state).toBe("failed")
    expect(fault).toContain("\"kolu\"")
    expect(fault).toContain("\"kinds\"")
    expect(fault).toContain("not one of the doors a row may hold")

    const teaching = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "odu",
        needs: [Kinds],
        apply: Effect.gen(function*() {
          yield* (yield* Kinds).register({ kind: "run", takes: "a run id", admits: () => true })
        }),
      }),
    )
    expect((yield* teaching.report).state).toBe("running")
    expect([...plugins.kinds().keys()]).toEqual(["odu-run"])
  })))
})

test("core doors accept alternative providers, refuse collisions and permit replacement", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const seen: Array<string> = []
    const consumer = yield* mountPlugin(plugins.host, definePlugin({
      name: "observer", needs: [Watching], apply: Effect.gen(function*() {
        yield* (yield* Watching).subscribe(() => Effect.void)
      }),
    }))
    expect((yield* consumer.report).state).toBe("waiting")
    const offering = (name: string) =>
      definePlugin({
        name,
        needs: [Offers],
        apply: Effect.gen(function*() {
          yield* (yield* Offers).offer(Watching, () => ({ subscribe: () => Effect.sync(() => { seen.push(name) }) }))
        }),
      })
    const first = yield* mountPlugin(plugins.host, offering("first-provider"))
    const second = yield* mountPlugin(plugins.host, offering("replacement-provider"))

    expect((yield* first.report).state).toBe("running")
    const [state, fault] = yield* rowOf(second)
    expect(state).toBe("failed")
    expect(fault).toBe(
      'plugins: "first-provider" and "replacement-provider" both offer "watching" — a '
        + "service stands behind one row, and the second would leave every "
        + "plugin that named it holding whichever was mounted last.",
    )
    expect([...plugins.offers()]).toEqual([["watching", "first-provider"]])
    yield* second.dispose
    expect([...plugins.offers()]).toEqual([["watching", "first-provider"]])

    yield* first.dispose
    expect((yield* consumer.report).state).toBe("waiting")
    expect([...plugins.offers()]).toEqual([])
    const replacement = yield* mountPlugin(plugins.host, offering("replacement-provider"))
    expect((yield* replacement.report).state).toBe("running")
    expect([...plugins.offers()]).toEqual([["watching", "replacement-provider"]])
    expect((yield* consumer.report).state).toBe("running")
    expect(seen).toEqual(["first-provider", "replacement-provider"])
  })))
})

test("the door a plugin stands behind is the door its dependents are handed", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen: Array<string> = []
    const plugins = yield* runtime()
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "chat",
        needs: [Offers],
        apply: Effect.gen(function*() {
          yield* (yield* Offers).offer(Deliveries, (who) => ({
            scopes: () => [{ agent: "a", session: "s", pick: `${who}.olai`, current: () => true }],

            deliver: () => Effect.void,
              notify: () => Effect.void,
          }))
        }),
      }),
    )
    const looking = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "kolu",
        needs: [Deliveries],
        apply: Effect.gen(function*() {
          for (const scope of (yield* Deliveries).scopes()) seen.push(String(scope.pick))
        }),
      }),
    )
    expect((yield* looking.report).state).toBe("running")
    expect(seen).toEqual(["kolu.olai"])
  })))
})

test("a plugin that unloads takes its door with it, and its dependents go waiting", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const standing = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "chat",
        needs: [Offers],
        apply: Effect.gen(function*() {
          yield* (yield* Offers).offer(Watching, () => ({ subscribe: () => Effect.void }))
        }),
      }),
    )
    const mirror = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "spaces",
        needs: [Watching],
        apply: Effect.gen(function*() {
          yield* (yield* Watching).subscribe(() => Effect.void)
        }),
      }),
    )
    expect((yield* mirror.report).state).toBe("running")

    yield* standing.dispose
    expect((yield* mirror.report).state).toBe("waiting")
  })))
})

test("a plugin that comes back stands behind its door again", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const chat = definePlugin({
      name: "chat",
      needs: [Offers],
      apply: Effect.gen(function*() {
        yield* (yield* Offers).offer(Watching, () => ({ subscribe: () => Effect.void }))
      }),
    })
    const first = yield* mountPlugin(plugins.host, chat)
    expect((yield* first.report).state).toBe("running")
    yield* first.dispose

    const again = yield* mountPlugin(plugins.host, chat)
    const [state, fault] = yield* rowOf(again)
    expect([state, fault]).toEqual(["running", ""])

    const mirror = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "spaces",
        needs: [Watching],
        apply: Effect.gen(function*() {
          yield* (yield* Watching).subscribe(() => Effect.void)
        }),
      }),
    )
    expect((yield* mirror.report).state).toBe("running")
  })))
})

test("offer preserves a lifecycle defect when the service already has an owner", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    let escaped: Effect.Effect<void, never, Scope.Scope> = Effect.void
    yield* mountPlugin(plugins.host, definePlugin({ name: "chat", needs: [Offers], apply: Effect.gen(function*() {
      const offers = yield* Offers
      escaped = offers.offer(Watching, () => ({ subscribe: () => Effect.void }))
      yield* escaped
    }) }))
    const fault = yield* escaped.pipe(
      Effect.as("unexpected success"),
      Effect.catchCause((cause) => Effect.succeed(String(Cause.squash(cause)))),
    )
    expect(fault).toBe("Error: effect-cordis: offer requires a plugin activation")
    expect([...plugins.offers()]).toEqual([["watching", "chat"]])
  })))
})

test("plugin-owned keys wait, activate, unwind before their provider, and use its replacement", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const Fleet = serviceTag<{ read: () => string }>("fleet-source.fleet")
    const seen: Array<string> = []
    const mirror = yield* mountPlugin(plugins.host, definePlugin({
      name: "mirror", needs: [Fleet], apply: Effect.gen(function*() {
        const fleet = yield* Fleet
        seen.push(fleet.read())
        yield* Effect.addFinalizer(() => Effect.gen(function*() {
          yield* Effect.sleep("5 millis")
          seen.push(`release:${fleet.read()}`)
        }))
      }),
    }))
    expect(yield* mirror.report).toEqual({ state: "waiting", missing: ["fleet-source.fleet"] })
    const provider = (version: string) => definePlugin({
      name: "fleet-source", needs: [Offers], apply: Effect.gen(function*() {
        let alive = true
        yield* Effect.addFinalizer(() => Effect.sync(() => { alive = false; seen.push(`closed:${version}`) }))
        yield* (yield* Offers).own("fleet", (consumer) => ({
          read: () => { expect(alive).toBe(true); return `${version}:${consumer}` },
        }))
      }),
    })
    const first = yield* mountPlugin(plugins.host, provider("v1"))
    expect((yield* mirror.report).state).toBe("running")
    expect([...plugins.offers()]).toEqual([["fleet-source.fleet", "fleet-source"]])
    yield* first.dispose
    expect((yield* mirror.report).state).toBe("waiting")
    expect([...plugins.offers()]).toEqual([])
    expect(seen).toEqual(["v1:mirror", "release:v1:mirror", "closed:v1"])
    const second = yield* mountPlugin(plugins.host, provider("v2"))
    expect((yield* mirror.report).state).toBe("running")
    expect(seen.at(-1)).toBe("v2:mirror")
    yield* second.dispose
  })))
})

for (const [name, word] of [["source", ""], ["source", "other.fleet"], ["source.other", "fleet"], ["source", "Fleet"], ["source", "../vault"]]) {
  test(`invalid plugin service segments are refused: ${name}/${word}`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      const row = yield* mountPlugin(plugins.host, definePlugin({
        name: name!, needs: [Offers], apply: Effect.gen(function*() {
          yield* (yield* Offers).own(word!, () => ({}))
        }),
      }))
      expect((yield* row.report).state).toBe("failed")
      expect([...plugins.offers()]).toEqual([])
    })))
  })
}

test("a failed plugin-owned offer never activates its consumer and releases its claim", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const Key = serviceTag<{ version: number }>("source.value")
    const seen: Array<number> = []
    const consumer = yield* mountPlugin(plugins.host, definePlugin({
      name: "consumer", needs: [Key], apply: Effect.gen(function*() { seen.push((yield* Key).version) }),
    }))
    for (const duplicate of [false, true]) {
      const failed = yield* mountPlugin(plugins.host, definePlugin({
        name: "source", needs: [Offers], apply: Effect.gen(function*() {
          const offers = yield* Offers
          yield* offers.own("value", () => ({ version: 1 }))
          if (duplicate) yield* offers.own("value", () => ({ version: 2 }))
          else yield* Effect.die("initialization failed")
        }),
      }))
      expect((yield* failed.report).state).toBe("failed")
      expect((yield* consumer.report).state).toBe("waiting")
      expect(seen).toEqual([])
      expect([...plugins.offers()]).toEqual([])
      yield* failed.dispose
    }
    yield* mountPlugin(plugins.host, definePlugin({
      name: "source", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).own("value", () => ({ version: 3 }))
      }),
    }))
    expect((yield* consumer.report).state).toBe("running")
    expect(seen).toEqual([3])
  })))
})

test("equal local words in different plugins stay distinct and cannot shadow core", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    for (const name of ["one", "two"]) {
      yield* mountPlugin(plugins.host, definePlugin({
        name, needs: [Offers], apply: Effect.gen(function*() {
          yield* (yield* Offers).own("vault", () => ({ owner: name }))
        }),
      }))
    }
    const One = serviceTag<{ owner: string }>("one.vault")
    const Two = serviceTag<{ owner: string }>("two.vault")
    const reader = yield* mountPlugin(plugins.host, definePlugin({
      name: "reader", needs: [One, Two, Vault], apply: Effect.gen(function*() {
        expect((yield* One).owner).toBe("one")
        expect((yield* Two).owner).toBe("two")
        expect((yield* Vault).served).toBe("/tmp/x")
      }),
    }))
    expect((yield* reader.report).state).toBe("running")
    expect([...plugins.offers()]).toEqual([["one.vault", "one"], ["two.vault", "two"]])
  })))
})

test("discovery follows plugin-owned offers without publishing internal core doors", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    expect(plugins.serviceKeys()).toEqual([...SERVICE_KEYS].sort())
    const provider = yield* mountPlugin(plugins.host, definePlugin({
      name: "alternative", needs: [Offers], apply: Effect.gen(function*() {
        const offers = yield* Offers
        yield* offers.offer(Ledger, () => ({
          wrote: () => {}, whyWaiting: () => Effect.succeed(""),
          record: () => Effect.void, push: Effect.void, resume: Effect.void,
          hold: Effect.void, waiting: Effect.succeed([]),
        }))
        yield* offers.own("history", () => ({}))
      }),
    }))
    expect((yield* provider.report).state).toBe("running")
    expect([...plugins.offers()]).toEqual([["ledger", "alternative"], ["alternative.history", "alternative"]])
    expect(plugins.serviceKeys()).toEqual([...SERVICE_KEYS, "alternative.history"].sort())
    yield* provider.dispose
    expect(plugins.serviceKeys()).toEqual([...SERVICE_KEYS].sort())
  })))
})

test("a late vault subscriber replays the published reading before receiving the next one", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const events = vaultEvents("/tmp")
    yield* events.published(snapshotOf("first"))
    const replaying = yield* Deferred.make<void>()
    const continueReplay = yield* Deferred.make<void>()
    const seen: string[] = []
    const listener = yield* Effect.forkScoped(events.door("late").revision((snapshot) =>
      Effect.gen(function*() {
        const value = saidIn(snapshot)
        seen.push(value)
        if (value === "first") {
          yield* Deferred.succeed(replaying, undefined)
          yield* Deferred.await(continueReplay)
        }
        seen.push(`${value} done`)
      })))
    yield* Deferred.await(replaying)
    const publish = yield* Effect.forkScoped(events.published(snapshotOf("second", 2)))
    yield* Effect.yieldNow
    expect(seen).toEqual(["first"])
    yield* Deferred.succeed(continueReplay, undefined)
    yield* Fiber.join(listener)
    yield* Fiber.join(publish)
    expect(seen).toEqual(["first", "first done", "second", "second done"])
  }))))

test("browser declarations are scoped discovery, not server provisions", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const Viewer = serviceTag<{}>("source.viewer")
    const consumer = yield* mountPlugin(plugins.host, definePlugin({
      name: "consumer", needs: [Viewer], apply: Effect.void,
    }))
    const provider = yield* mountPlugin(plugins.host, definePlugin({
      name: "source", needs: [Offers], apply: Effect.gen(function*() {
        yield* (yield* Offers).browser(["viewer"])
      }),
    }))
    expect(plugins.browserKeys()).toEqual(["source.viewer"])
    expect(plugins.serviceKeys()).not.toContain("source.viewer")
    expect((yield* consumer.report).state).toBe("waiting")
    yield* provider.dispose
    expect(plugins.browserKeys()).toEqual([])
  })))
})

for (const words of [["viewer", "viewer"], ["viewer", "other.viewer"]]) {
  test(`invalid browser declarations roll back: ${words.join(", ")}`, async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      const row = yield* mountPlugin(plugins.host, definePlugin({
        name: "source", needs: [Offers], apply: Effect.gen(function*() {
          yield* (yield* Offers).browser(words)
        }),
      }))
      expect((yield* row.report).state).toBe("failed")
      expect(plugins.browserKeys()).toEqual([])
    })))
  })
}

test("a synchronous replay failure cannot prevent later subscribers or publications", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const events = vaultEvents("/tmp")
    yield* events.published(snapshotOf("first"))
    yield* events.door("thrower").revision(() => { throw new Error("nope") })
    const seen: string[] = []
    yield* events.door("neighbour").revision((snapshot) => Effect.sync(() => { seen.push(saidIn(snapshot)) }))
    yield* events.published(snapshotOf("second", 2))
    expect(seen).toEqual(["first", "second"])
  }))))

test("the vault Inbox registry reads absence, owns updates, and withdraws with its provider", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const vault = vaultEvents("/tmp")
    const reader = vault.door("chat").inbox
    const seen: Array<string | null> = []
    expect(reader.current()).toBeNull()
    yield* reader.changed(file => Effect.sync(() => { seen.push(file) }))
    const release = yield* Deferred.make<void>()
    const registered = yield* Deferred.make<void>()
    const provider = yield* Effect.forkScoped(Effect.scoped(Effect.gen(function*() {
      const update = yield* vault.door("capture").inbox.register("Inbox.olai")
      yield* update("notes/Inbox.olai")
      yield* Deferred.succeed(registered, undefined)
      yield* Deferred.await(release)
    })))
    yield* Deferred.await(registered)
    expect(reader.current()).toBe("notes/Inbox.olai")
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(provider)
    expect(reader.current()).toBeNull()
    expect(seen).toEqual([null, "Inbox.olai", "notes/Inbox.olai", null])
    yield* Effect.scoped(vault.door("capture-again").inbox.register("Inbox.olai"))
    expect(reader.current()).toBeNull()
  }))))

test("the configuration broker follows a reader through absence, a revision and its return", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const seen = yield* Queue.unbounded<Configuration | undefined>()
    yield* mountPlugin(plugins.host, definePlugin({
      name: "follower",
      needs: [ConfigurationWatch],
      apply: Effect.gen(function*() {
        const watch = yield* ConfigurationWatch
        yield* Effect.forkScoped(Stream.runForEach(watch.changes, (value) => Queue.offer(seen, value)))
      }),
    }))
    expect(yield* Queue.take(seen)).toBeUndefined()

    const row = (commit: string): Configuration => ({
      revision: 1,
      rows: new Map([["git", { config: { commit, push: "off" }, values: [] }]]),
    })
    let current = row("auto")
    let publish: ((next: Configuration) => Effect.Effect<void>) | undefined
    const reader = (initial: Configuration) => definePlugin({
      name: "settings",
      needs: [Offers],
      apply: Effect.gen(function*() {
        current = initial
        const ref = yield* SubscriptionRef.make(initial)
        yield* (yield* Offers).offer(ConfigurationSource, () => ({
          current: () => current,
          changes: SubscriptionRef.changes(ref),
        }))
        publish = (next) => Effect.suspend(() => {
          current = next
          return SubscriptionRef.set(ref, next)
        })
      }),
    })

    const first = yield* mountPlugin(plugins.host, reader(row("auto")))
    expect((yield* Queue.take(seen))?.rows.get("git")?.config.commit).toBe("auto")
    yield* publish!(row("manual"))
    expect((yield* Queue.take(seen))?.rows.get("git")?.config.commit).toBe("manual")
    yield* first.dispose
    expect(yield* Queue.take(seen)).toBeUndefined()
    yield* mountPlugin(plugins.host, reader(row("off")))
    expect((yield* Queue.take(seen))?.rows.get("git")?.config.commit).toBe("off")
  }))))
