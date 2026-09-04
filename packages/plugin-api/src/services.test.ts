/**
 * THE SERVICES' OWN BENCH — what a registration does to the table it writes
 * into, and what it does when the composition root refuses it.
 *
 * The claims in `@olai/bundle` are about the COMPOSITION and the ones in
 * `@olai/server` are about the WIRING; what is left, and what is here, is the
 * one thing neither can ask: whether a service's table tells the truth after a
 * registration that did not take.
 *
 * ## The plugins here are Effects, which is what makes half of this readable
 *
 * A case builds the runtime with {@link openPlugins}, mounts a plugin written
 * exactly as a real one is, and reads the doors. What it does NOT do is reach
 * for a Cordis context: there is none to reach for, in this package or in any
 * other but one.
 */

import { expect, test } from "bun:test"
import { Cause, Effect, Layer, Logger, type Scope } from "effect"

import {
  Deliveries,
  LocalState,
  definePlugin,
  Kinds,
  type Mounted,
  mountPlugin,
  Offers,
  openPlugins,
  Ops,
  type PluginsConfig,
  SessionStart,
  Surfaces,
  Vault,
  Wakes,
  Watching,
} from "./services.ts"

/** What a probe answers on a machine that simply does not have the tool — the
 *  ordinary arm, and the one these cases need because none of them is about
 *  what a probe FOUND. */
const NOTHING_FOUND = { server: null, missing: null }

/** A sibling with nothing on it — what these cases register, since none of them
 *  is about a surface. */
const NOTHING = { surface: { spec: {} }, faces: {}, deps: {} }

/** A whole wake, because every field of one is required and none of the cases
 *  below is about the words. */
const WAKING = {
  subject: "terminal activity",
  from: "terminals from",
  waiting: { one: "line", many: "lines" },
  kinds: ["outline"] as readonly [string, ...Array<string>],
  faults: { gone: "the file left", unwatchable: "not an outline" },
}

/** WHAT WAS LOGGED, for the containment cases. Inlined rather than borrowed from
 *  `@olai/log`, because this package declares nothing but `effect` and
 *  `solid-js` and a bench is not a reason to grow that. */
const collector = (): { readonly layer: Layer.Layer<never>; readonly said: Array<string> } => {
  const said: Array<string> = []
  const logger = Logger.make<unknown, void>(({ cause, logLevel, message }) => {
    if (logLevel !== "Warn") return
    // THE CAUSE IS ITS OWN FIELD, not part of the message — which is exactly the
    // arrangement these cases are about: the door says WHOSE handler failed and
    // the runtime carries WHAT it failed with, and a line has to have both.
    const words = (Array.isArray(message) ? message : [message]).map(String)
    if (cause.reasons.length > 0) words.push(String(Cause.squash(cause)))
    said.push(words.join(" "))
  })
  return { layer: Logger.layer([logger]), said }
}

/** The ordinary runtime for a case: nothing the plugins here name is a real
 *  thing, because none of these cases is about one. */
const runtime = (config: Partial<PluginsConfig> = {}) =>
  openPlugins({
    vars: {},
    now: () => "2026-09-02T00:00:00.000Z",
    served: "/tmp/x",
    ...config,
  })

/** One plugin that registers a sibling, mounted under `name`. */
const registering = (name: string) =>
  definePlugin({
    name,
    needs: [Surfaces],
    apply: Effect.gen(function*() {
      yield* (yield* Surfaces).register(NOTHING)
    }),
  })

/**
 * A SIBLING THE ROOT REFUSED IS NOT IN THE TABLE, and the plugin that registered
 * it is the only one that fails.
 *
 * ## The defect this is about
 *
 * `register` set the entry, told the root, and returned. A `changed()` that
 * threw left the entry in the table, because a failure in `acquire` is a
 * resource that was never acquired and its release never runs. The plugin landed
 * `failed`, which is what the containment claim says — and its sibling was still
 * composed, so the NEXT plugin to register re-ran the re-compose, which retried
 * the bad mount and threw inside THAT plugin's `apply`. One plugin's mis-shaped
 * surface took down every plugin that arrived after it, each of them failing on
 * somebody else's refusal.
 *
 * The claim the phase makes — "a plugin whose `apply` fails installed nothing,
 * and its siblings stay running" — was false on exactly this path, which is why
 * it is a case rather than a paragraph.
 */
test("a sibling the composition root refused leaves the table, and takes only its own plugin down", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const seen: Array<number> = []
    // A REFUSAL AND NOT A CRASH is what the composition root actually does: the
    // rooted bundle's `mount` is transactional, so a sibling with deps that do
    // not match its surface, or a key already mounted, throws out of the
    // re-compose — which is this callback, standing in for it.
    // A HOLDER, because the callback is handed over before the thing it reads
    // exists — which is the same order the composition root keeps, and the reason
    // its own re-compose arrives through one.
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

    // The refused one is gone from the table, so nothing downstream can be told
    // it is composed — the roster reads this list, and a row saying `running`
    // about a sibling with no tag on the wire is the one thing it may not say.
    expect(opened.composed().map((one) => one.name)).toEqual(["good", "later"])

    // ...and the failure is exactly one plugin's.
    expect([
      (yield* good.report).state,
      (yield* bad.report).state,
      (yield* later.report).state,
    ]).toEqual(["running", "failed", "running"])

    // The re-compose was told about every registration, including the one it
    // refused — so the case is not passing because nothing was ever composed.
    expect(seen.length).toBeGreaterThanOrEqual(3)
  })))
})

/**
 * ...AND THE ORDINARY DISPOSE still takes a sibling out, which is what keeps the
 * case above from passing over a `register` that never wrote anything.
 */
test("an unloaded plugin's sibling leaves the table too", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const mounted = yield* mountPlugin(plugins.host, registering("kolu"))
    expect(plugins.composed().map((one) => one.name)).toEqual(["kolu"])
    yield* mounted.dispose
    expect(plugins.composed()).toEqual([])
  })))
})

/**
 * THE SAME QUESTION ASKED OF `kinds`, because it is the other registration that
 * can refuse — and the answer is different, which is worth pinning rather than
 * leaving a reader to assume symmetry.
 *
 * `register` refuses BEFORE it acquires anything (a second claim on one word is
 * a death with both plugins named), so there is no half-written entry for a
 * failure to leave behind. What this holds is that the refusing plugin's OWN
 * word is not in the table either, and the first plugin's is.
 */
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
/**
 * WHAT A PLUGIN REGISTERS IS ON THE LIST, AND IT IS STAMPED WITH ITS NAME —
 * the `chat/session-start` contract, held where it can be false.
 *
 * ## The two defects this is about, one retired and one made unrepresentable
 *
 * It was a WATERFALL, and the composition root fired it and returned the
 * payload without awaiting the dispatch — which worked for exactly as long as
 * every listener was synchronous up to its `next()`. A plugin that yielded
 * anything before its push would have been silently absent from EVERY session,
 * for ever, with nothing red, on the one path whose whole subject is a tool that
 * is missing. Registration is an ordinary `acquireRelease` on the plugin's scope
 * now, so there is no dispatch to fail to await.
 *
 * And a plugin SIGNED ITS OWN NAME into that payload, where every other keyed
 * door reads the word off the fiber. It cannot: the door takes an Effect and
 * nothing else, and the name below is the one the runtime bound each plugin
 * under.
 *
 * ## THE LIST IS THE OFFERING ROW'S, which is what makes this a claim about core
 *
 * `session-start` is one of the four a row offers, and core provides none of
 * them — so the collecting end below is a plugin, exactly as the chat row is,
 * and what is on trial here is the only part that is still core's: the STAMP.
 * The provision is called once per NAMING plugin with the word the loader bound
 * that fiber under, so `ask` has no parameter to sign and none of these plugins
 * could sign one. It reads its own list back because there is nowhere else the
 * list could be.
 */
const collecting = (asked: Array<{ readonly name: string }>) =>
  definePlugin({
    name: "chat",
    needs: [Offers],
    apply: Effect.gen(function*() {
      yield* (yield* Offers).offer(SessionStart, (plugin) => ({
        // THE ONLY THING THE CALLER GIVES IS THE PROBE. The name is this
        // provision's argument, which is the fiber's own word.
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
          // A yield of any kind before the registration — which is what a
          // plugin that read a file, or asked another service, would do.
          if (slow) yield* Effect.yieldNow
          order.push(name)
          // NO NAME IS WRITTEN HERE, and there is no parameter to write one in.
          yield* (yield* SessionStart).ask(Effect.succeed(NOTHING_FOUND))
        }),
      })
    yield* mountPlugin(plugins.host, asking("prompt", false))
    yield* mountPlugin(plugins.host, asking("slow", true))

    expect(asked.map((one) => one.name)).toEqual(["prompt", "slow"])
    expect(order).toEqual(["prompt", "slow"])
  })))
})

/** ...and a plugin that has unloaded contributes nothing to the next session,
 *  which is the whole reason the registration is a finalizer on its own scope
 *  rather than an entry somebody remembers to remove. */
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

/**
 * A LISTENER THAT FAILS IS ONE LISTENER'S PROBLEM — which the composition root's
 * header asserted for a year and the dispatcher did not hold.
 *
 * `vault/revision` and `vault/unloaded` were Cordis EMITS, and the root said of
 * them: *"Both are EMITS, so a listener that throws is one listener's problem —
 * the dispatcher contains it."* Cordis's `emit` is a bare loop of
 * `Reflect.apply` with no `try` in it, so a plugin that threw on a revision took
 * two things that were never its to take: every LATER plugin on that revision,
 * and the directory fiber that published it.
 *
 * The doors wrap once, and this is the case that says so: the arrangement is
 * only worth anything if a handler that dies leaves its neighbour and its caller
 * standing.
 */
test("a vault listener that dies costs the next plugin nothing", async () => {
  const heard: Array<string> = []
  const { layer, said } = collector()
  await Effect.runPromise(
    Effect.scoped(Effect.gen(function*() {
      const plugins = yield* runtime()
      // TWO PLUGINS, and the failing one FIRST: the failure this pins is a loop
      // that stops, so a case with the thrower last would pass over a dispatcher
      // that contains nothing at all.
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

      // THE CALLER IS STILL STANDING, which is the half that matters most: this
      // is rung inside the store's own fiber, and a failure out of it would fail
      // the directory read rather than one plugin's walk.
      yield* plugins.published({ rev: 1 })
    })).pipe(Effect.provide(layer)),
  )
  // ...the neighbour heard the revision the thrower did not finish...
  expect(heard).toEqual(["neighbour"])
  // ...and the failure was SAID, on the owner's channel, with the plugin's name
  // on it. A contained fault nobody is told about is the same silence the
  // uncontained one had, one layer in.
  expect(said).toHaveLength(1)
  expect(said[0]).toContain("thrower")
  expect(said[0]).toContain("a walk this plugin could not finish")
  // ...and the neighbour is not blamed for it.
  expect(said[0]).not.toContain("neighbour")
})

/** ...and the same for the store going quiet, which is the other door and the
 *  one whose NAME has been misread before: `unloaded` says the STORE has never
 *  published, not that the plugin is being torn down. */
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

/** A LISTENER LEAVES WITH ITS PLUGIN, like every other registration here — the
 *  subscription is a finalizer on the plugin's scope, so unloading it takes the
 *  subscription out of the set and nothing has to remember to. */
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
    yield* plugins.published({ rev: 1 })
    expect(heard).toEqual(["leaver"])
    yield* mounted.dispose
    yield* plugins.published({ rev: 2 })
    expect(heard).toEqual(["leaver"])
  })))
})

/**
 * THE STAMP IS THE FIBER'S, asked of the door where getting it wrong costs the
 * most: a plugin's doorbell reaches conversations somebody scoped to THAT
 * plugin, and there is no argument on either verb by which one could name
 * another.
 *
 * THROUGH THE ROW THAT OFFERS IT, because that is the only way `deliveries`
 * exists — core provides none of the four. So the provision under test is a
 * plugin's, and what is core's is the thing being asserted: it is called once
 * per NAMING plugin, with the word the loader bound that fiber under.
 */
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
              scopes: () => [{ agent: "a", session: "s", file: `${plugin}.olai` }],
              ringing: (file) => [{ agent: "a", session: "s", file }],
              deliver: () => Effect.void,
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
          for (const scope of (yield* Deliveries).scopes()) seen.push(scope.file)
        }),
      })
    yield* mountPlugin(plugins.host, looking("kolu"))
    yield* mountPlugin(plugins.host, looking("odu"))
    expect(seen).toEqual(["kolu.olai", "odu.olai"])
    expect(asked).toEqual(["kolu", "odu"])
  })))
})

/** THE HELD DOOR IS MINTED ONCE per plugin, which is what orders its writes —
 *  the chain that keeps a later snapshot from losing a rename race to an earlier
 *  one lives on the door, so a door minted per CALL orders nothing. It was
 *  minted per call. */
test("a plugin's held door is one door, however many times it is used", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    let minted = 0
    const plugins = yield* runtime({
      localStateFor: () => {
        minted += 1
        let record: Record<string, unknown> | null = null
        return { load: () => record, save: (value) => void (record = value) }
      },
    })
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "spaces",
        needs: [LocalState],
        apply: Effect.gen(function*() {
          const held = yield* LocalState
          yield* held.save({ queue: ["B"] })
          yield* held.save({ queue: [] })
          expect(yield* held.load).toEqual({ queue: [] })
        }),
      }),
    )
    // ONE door for the whole plugin, three uses of it.
    expect(minted).toBe(1)
    // ...and a second plugin gets its own, which is the other half of the keying.
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

/**
 * ...AND ONE DOOR PER PLUGIN NAME, which is the half the case above could not
 * see: it minted per ACTIVATION, and one plugin can activate twice.
 *
 * A plugin that unloads and comes back is two fibers writing ONE FILE, and the
 * chain that orders those writes lives on the door — so a second door is a second
 * chain and a save still in flight from the first activation can land after one
 * handed over by the second. Unreachable while nothing unloaded a server half
 * mid-serve; a row that stands behind another row's doors makes it routine.
 */
test("a plugin that comes back writes down the chain it was already writing down", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    let minted = 0
    const plugins = yield* runtime({
      localStateFor: () => {
        minted += 1
        let record: Record<string, unknown> | null = null
        return { load: () => record, save: (value) => void (record = value) }
      },
    })
    const spaces = definePlugin({
      name: "spaces",
      needs: [LocalState],
      apply: Effect.gen(function*() {
        yield* (yield* LocalState).save({ queue: ["B"] })
      }),
    })
    const first = yield* mountPlugin(plugins.host, spaces)
    yield* first.dispose
    const again = yield* mountPlugin(plugins.host, spaces)
    expect((yield* again.report).state).toBe("running")
    expect(minted).toBe(1)
  })))
})

/**
 * WHAT EVERY RINGING PLUGIN DECLARED, READ BY A PLUGIN — the one read side on
 * this door, and the reason it is READ AFRESH rather than handed over as a table.
 *
 * The reading that needs it refuses a conversation scope written for a plugin
 * that declared no wake, and a plugin that unloaded between one refusal and the
 * next has taken its declaration with it. A snapshot would go on offering a
 * doorbell nobody is behind, which is the silence the whole fault machinery
 * exists to break.
 */
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
    // THE READER IS A PLUGIN TOO, holding the Effect rather than its answer —
    // which is the only way to ask the question twice.
    let asking: Effect.Effect<ReadonlyMap<string, unknown>> = Effect.succeed(new Map())
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "chat",
        needs: [Wakes],
        apply: Effect.gen(function*() {
          asking = (yield* Wakes).declared
        }),
      }),
    )
    expect([...(yield* asking).keys()]).toEqual(["kolu"])
    yield* ringing.dispose
    expect([...(yield* asking).keys()]).toEqual([])
  })))
})

/** ONE PLUGIN'S ROW, as the word and the sentence a person would read.
 *
 *  A refusal in `offer` is a DEATH — the fiber lands `failed` carrying what it
 *  threw, verbatim — so the cases below assert the WORDS rather than a boolean
 *  about them: the whole reason the claim is taken in this file rather than left
 *  to the runtime is that the runtime's own sentence names neither author. An
 *  empty second element is a row that did not fail, which is what the cases that
 *  expect `running` read. */
const rowOf = (mounted: Mounted) =>
  Effect.map(mounted.report, (report) => [
    report.state,
    report.state === "failed" ? report.fault ?? "" : "",
  ] as const)

/**
 * A PLUGIN MAY NOT SPELL A KEY OUTSIDE THE TABLE, and the fence is not the type.
 *
 * {@link Offers.offer} is four overloads, so a plugin cannot WRITE this line —
 * which is the whole reason the shape is overloads rather than a generic. The
 * cast below is what it would take to get past that, and the point of the case is
 * that getting past the compiler buys nothing: the table is read at the call, in
 * olai's own words, and the offering row is the only thing that falls over.
 *
 * `kinds` is the key it tries for on purpose. A row standing behind the
 * VOCABULARY would be a row deciding what every vault in this serve validates
 * against, which is the worst thing on the page and the reason the table is
 * closed rather than merely documented.
 */
/**
 * A REFUSED WRITE REACHES WHOEVER IS WATCHING WRITES — and the seam is new, so
 * this is the claim that says it is connected at all.
 *
 * ## The wire it replaced was a direct call
 *
 * `@olai/server`'s ops layer used to hand a refusal straight to the chat, in one
 * statement, because the composition root held both: `onRefusal: (request,
 * failure) => chat.recordRefusal(request.op, failure)`. The chat is a ROW now,
 * so the refusal crosses a bus — the root rings {@link Plugins.refused} and the
 * plugin subscribes on {@link Ops.refused} — and a bus that was wired to nothing
 * would look exactly like a serve nobody has refused a write in. What a person
 * would see is a tool call turned down and a transcript that never says so.
 *
 * ## Two things at once, and both are the seam rather than the payload
 *
 * That a subscriber is TOLD, with the write's own verb and its failure carried
 * through untouched; and that a plugin which unloaded is not — the subscription
 * is a finalizer on the calling plugin's scope, which is what makes "a plugin
 * that left stops being told" true without anybody remembering to say so.
 */
test("a refused write reaches every plugin watching writes, and stops when one leaves", async () => {
  const heard: Array<{ readonly who: string; readonly op: string; readonly tag: string }> = []
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
                heard.push({ who: name, op: refusal.op, tag: refusal.failure._tag })
              })
            )
          }),
        })
      const mirror = yield* mountPlugin(plugins.host, watching("mirror"))
      yield* mountPlugin(plugins.host, watching("panel"))

      yield* plugins.refused({ op: "prop", failure: { _tag: "UsageFailure" } })
      // BOTH, in subscription order, each with the verb and the failure's own
      // tag — the payload is carried and not composed around.
      expect(heard).toEqual([
        { who: "mirror", op: "prop", tag: "UsageFailure" },
        { who: "panel", op: "prop", tag: "UsageFailure" },
      ])

      // ...and a plugin that leaves stops being told, which is the half a
      // hand-rolled bus gets wrong.
      heard.length = 0
      yield* mirror.dispose
      yield* plugins.refused({ op: "trash", failure: { _tag: "ValidationFailure" } })
      expect(heard).toEqual([{ who: "panel", op: "trash", tag: "ValidationFailure" }])
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
          // WHAT A PLUGIN WOULD HAVE TO WRITE to try, spelled out rather than
          // hidden in a helper: there is no overload for this and there is no
          // arm of the interface where one could be added.
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

    // ...and the vocabulary is untouched: the refusal happened before anything
    // was provided, so `kinds` is still core's and a plugin that teaches a word
    // still can.
    const teaching = yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "odu",
        needs: [Kinds],
        apply: Effect.gen(function*() {
          yield* (yield* Kinds).register({ kind: "worktree", takes: "a checkout", admits: () => true })
        }),
      }),
    )
    expect((yield* teaching.report).state).toBe("running")
    expect([...plugins.kinds().keys()]).toEqual(["odu-worktree"])
  })))
})

/**
 * TWO ROWS MAY NOT STAND BEHIND ONE DOOR, and the refusal NAMES BOTH — which is
 * the entire reason the claim is taken here rather than left to the runtime.
 *
 * Cordis refuses the second `provide` on its own, and its sentence is `service
 * "watching" has been registered at <root>`: it names neither author, and
 * `<root>` is a fiber no person has ever heard of. What a person reads on a
 * preferences row has to be this tree's, so the claim goes first and cordis is
 * never reached.
 */
test("two plugins standing behind one door: the second is refused, naming both and the key", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
    const offering = (name: string) =>
      definePlugin({
        name,
        needs: [Offers],
        apply: Effect.gen(function*() {
          yield* (yield* Offers).offer(Watching, () => ({ subscribe: () => Effect.void }))
        }),
      })
    const first = yield* mountPlugin(plugins.host, offering("chat"))
    const second = yield* mountPlugin(plugins.host, offering("mirror"))

    expect((yield* first.report).state).toBe("running")
    const [state, fault] = yield* rowOf(second)
    expect(state).toBe("failed")
    expect(fault).toContain("\"chat\"")
    expect(fault).toContain("\"mirror\"")
    expect(fault).toContain("\"watching\"")
  })))
})

/**
 * WHAT A ROW OFFERS IS WHAT ITS DEPENDENTS GET, which is the half that makes the
 * mechanism worth anything — and, for exactly one phase, the half that says core
 * has STEPPED ASIDE rather than won the race.
 *
 * Core provides `deliveries` nowhere, so there is exactly one candidate and the
 * question is whether the HAND-OVER keeps the keying: the offering row writes
 * one provision, and every consumer must be handed its own view of it, stamped
 * with its own word. This case reads the door on the far side to say so.
 */
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
            // STAMPED BY THE OFFERING ROW'S PROVISION with the word the registry
            // bound the CONSUMER under — the keying survives the hand-over,
            // which is the property that would be worth nothing if it did not.
            scopes: () => [{ agent: "a", session: "s", file: `${who}.olai` }],
            ringing: () => [],
            deliver: () => Effect.void,
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
          for (const scope of (yield* Deliveries).scopes()) seen.push(scope.file)
        }),
      }),
    )
    expect((yield* looking.report).state).toBe("running")
    expect(seen).toEqual(["kolu.olai"])
  })))
})

/**
 * A DOOR GOES WHEN THE ROW BEHIND IT GOES, and everything that named it goes
 * `waiting` — the cascade the whole arrangement is bought with, and the one a
 * reader should be able to see happen rather than take on trust.
 *
 * There is no undo written anywhere for this: the offer is an `acquireRelease` on
 * the offering plugin's own scope, so disposing it revokes the standing, and
 * revoking a service unloads every fiber that named it. `waiting` and not
 * `failed` is the whole distinction — nothing went wrong, there is simply nobody
 * behind the door, which is exactly what a serve started with `--plugins=kolu`
 * looks like.
 */
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

/**
 * ...AND A ROW THAT COMES BACK STANDS BEHIND ITS DOOR AGAIN, which is the claim's
 * own half of the same sentence.
 *
 * The claim is released by the finalizer that runs on the way out, and
 * `Registry.claim` reads the table at the moment the claim TAKES rather than
 * where it was written — so a plugin re-applying after its own unwind finds the
 * key free. A snapshot taken at the call would refuse a plugin the entry it had
 * just given back, and that failure looks exactly like a genuine collision on
 * every channel there is.
 */
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

    // ...and a dependent mounted after the return is running against the SECOND
    // standing, so the case is not passing over a claim nobody re-took.
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
