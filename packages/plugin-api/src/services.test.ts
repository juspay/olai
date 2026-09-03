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
import { Cause, Effect, Layer, Logger } from "effect"

import {
  Deliveries,
  Held,
  definePlugin,
  Kinds,
  mountPlugin,
  openPlugins,
  type PluginsConfig,
  SessionStart,
  Surfaces,
  Vault,
} from "./services.ts"

/** What a probe answers on a machine that simply does not have the tool — the
 *  ordinary arm, and the one these cases need because none of them is about
 *  what a probe FOUND. */
const NOTHING_FOUND = { server: null, missing: null }

/** A sibling with nothing on it — what these cases register, since none of them
 *  is about a surface. */
const NOTHING = { surface: { spec: {} }, faces: {}, deps: {} }

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
 */
test("what a plugin asks is on the list, under the name its fiber was bound with", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
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

    const asked = yield* plugins.sessionStart
    expect(asked.map((one) => one.name)).toEqual(["prompt", "slow"])
    expect(order).toEqual(["prompt", "slow"])
  })))
})

/** ...and a plugin that has unloaded contributes nothing to the next session,
 *  which is the whole reason the list is READ per session open rather than once
 *  at boot. */
test("an unloaded plugin is off the next session's list", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const plugins = yield* runtime()
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
    expect((yield* plugins.sessionStart).map((one) => one.name)).toEqual(["kolu"])
    yield* mounted.dispose
    expect(yield* plugins.sessionStart).toEqual([])
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
 */
test("the doorbell's door is keyed by the plugin, with no way to spell another's", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const asked: Array<string> = []
    const plugins = yield* runtime({
      doorFor: (plugin) => {
        asked.push(plugin)
        return {
          scopes: () => [{ agent: "a", session: "s", file: `${plugin}.olai` }],
          deliver: () => Effect.void,
        }
      },
    })
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
      heldFor: () => {
        minted += 1
        let record: Record<string, unknown> | null = null
        return { load: () => record, save: (value) => void (record = value) }
      },
    })
    yield* mountPlugin(
      plugins.host,
      definePlugin({
        name: "spaces",
        needs: [Held],
        apply: Effect.gen(function*() {
          const held = yield* Held
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
        needs: [Held],
        apply: Effect.gen(function*() {
          expect(yield* (yield* Held).load).toBeNull()
        }),
      }),
    )
    expect(minted).toBe(2)
  })))
})
