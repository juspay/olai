/**
 * THE BRIDGE, DRIVEN WITH TOY SERVICES — no olai noun in the file, on purpose.
 *
 * The four claims are the four halves of what a plugin runtime is, and each one
 * is a thing this package would otherwise be asserting in prose:
 *
 *   - a plugin sits `waiting` until the service it names is provided, and starts
 *     the moment one is;
 *   - its finalizers run in reverse when it unloads;
 *   - a provider that is REPLACED re-runs the plugin, which is the reactive half
 *     nothing in Effect's own `Layer` has;
 *   - a plugin whose Effect dies lands `failed`, having installed nothing, with
 *     its siblings untouched.
 *
 * There is a fifth here that the phase's list does not name and that the doors
 * downstream all rest on: the STAMP a keyed service is minted with is the word
 * the registry bound the fiber under, and there is no argument by which a plugin
 * could supply another.
 *
 * And a sixth, which is the four halves above asked about a PLUGIN rather than
 * about a composition root: one plugin standing behind a key another plugin
 * names. A host's own provision is there before anything is mounted, so the
 * `waiting` above is only ever entered and left once; a plugin's arrives while
 * the runtime is already moving, and leaves when it unloads. `settled` is the
 * verb that waits that out, and the last two cases are its two directions.
 */

import { expect, test } from "bun:test"
import { Cause, Effect, Logger, Schema, Scope } from "effect"

import { definePlugin, detached, PluginName } from "./plugin.ts"
import { mountPlugin, openHost, provide, settled } from "./host.ts"
import { offer } from "./lifecycle.ts"
import { serviceTag } from "./service.ts"

/** A TOY SERVICE, and it is keyed by the calling plugin so the stamp claim has
 *  something to be about. */
interface Ledger {
  readonly write: (line: string) => Effect.Effect<void>
}
const Ledger = serviceTag<Ledger>("ledger")

interface Counter {
  readonly bump: Effect.Effect<void>
}
const Counter = serviceTag<Counter>("counter")

/** One ledger for the whole test, with every line stamped by whoever wrote it. */
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
    // ...and the report SAYS WHAT IT IS SHORT OF, which is the half of `waiting`
    // a person can act on: the key, read back off the fiber's own `inject`.
    expect(yield* mounted.report).toEqual({ state: "waiting", missing: ["ledger"] })
    expect(lines).toEqual([])

    yield* provide(host, Ledger, ledgerOf(lines))
    // The fiber reloads on its own inertia; awaiting the report is what settles
    // it, exactly as a caller of `rowReport` would.
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
            // ...and the plugin's own word, which is the same word, read off the
            // ambient reference rather than off a module constant.
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
    // The provider went with that scope: the plugin unwound.
    yield* Effect.sleep("10 millis")
    expect(lines).toEqual(["scribe: up", "scribe: down"])
    // ...and a new one brings it back, which is the half `Layer` has no answer
    // for at all.
    yield* provide(host, Ledger, ledgerOf(lines))
    yield* Effect.sleep("10 millis")
    expect(lines).toEqual(["scribe: up", "scribe: down", "scribe: up"])
  })))
})

/** Empty needs still has a lifetime: the host's enclosing scope. */
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
    // A provision comes and goes — the shutdown path, for every plugin that
    // named it. This one named nothing, so the revocation has no dependent.
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
    // INSTALLED NOTHING: what it had put up came back down before the throw did.
    expect(lines).toEqual(["broken: up", "broken: down"])
    // ...and the sibling never heard about it.
    expect(yield* sibling.report).toEqual({ state: "running" })
  })))
})

test("a finalizer that dies on the way out does not steal the plugin's fault", async () => {
  // THE ARM THIS IS ABOUT is the one where BOTH halves fail: the `apply` dies,
  // and a finalizer it had already installed dies on the unwind. `Scope.close`
  // is typed `Effect<void>` and is not infallible — it ends on the combination
  // of every finalizer's exit — so the promise it is run through REJECTED, the
  // re-throw below it never ran, and what Cordis recorded as the row's fault was
  // the CLEANUP's defect. An operator read "the disk went away" on the
  // preferences row of a plugin that had failed because a socket was missing.
  //
  // The plugin's failure is the subject; it wins, and the unwind is said beside
  // it on the log rather than in place of it.
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
    // THE PLUGIN'S OWN WORDS, not the finalizer's.
    expect(yield* broken.report).toEqual({
      state: "failed",
      fault: "the socket is not there",
    })
  })).pipe(Effect.provide(Logger.layer([collector]))))
  // ...and the unwind is not silent either: it is said, with the plugin's word
  // on it, beside the failure rather than instead of it.
  expect(said.some((line) => line.includes("unwinding after a failed start"))).toBe(true)
  expect(said.some((line) => line.includes(`"broken"`))).toBe(true)
})

test("a defect in detached work is said, with the plugin's word on it", async () => {
  // FIRE AND FORGET IS NOT SILENT, and for a round it was: the fiber `detached`
  // forks is discarded and effect's error reporting is opt-in, so a defect in
  // the one seam every plugin drives its real work through — a doorbell walk, a
  // snapshot the mirror persists, a heartbeat — vanished entirely. No log, no
  // fault, no row.
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
    // The work is forked, so it settles a beat after the `apply` returns.
    yield* Effect.sleep("10 millis")
  })).pipe(Effect.provide(Logger.layer([collector]))))
  // THE PLUGIN'S WORD, THE OCCASION, AND THE CAUSE — the same sentence the bus
  // and the waterfall say, which is the point of it being one function.
  const detachedLine = said.find((line) => line.includes("detached work"))
  expect(detachedLine).toBeDefined()
  expect(detachedLine).toContain(`"scribe"`)
  expect(detachedLine).toContain("the watcher threw")
})

test("a scope a plugin opened is closed by the disposer, not by the fiber", async () => {
  // The two accumulators are one accumulator, asserted rather than argued: a
  // resource acquired with `Effect.acquireRelease` inside an `apply` is held for
  // exactly as long as the fiber is, with nothing in the plugin doing the
  // holding.
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

/**
 * ONE PLUGIN BEHIND A KEY ANOTHER PLUGIN NAMES — and the mount alone does not
 * cover it.
 *
 * This is the bundle's shape once a ROW provides a service, written with two
 * hand-mounted plugins because the fact is the runtime's and not the loader's.
 * Mounting the provider awaits the PROVIDER's fiber and nothing else — Cordis's
 * `await()` loops on a fiber's own inertia — so the dependent it woke is still
 * inside its `apply` when the mount returns, and everything a caller reads on
 * the next line (a report, a kind registry, a surface table) is read early.
 *
 * THE MACROTASK IS THE SUBJECT rather than decoration. Without one the whole
 * cascade finishes inside the mount's own microtask chain and every reading is
 * accidentally right, which is exactly the coincidence this tree was relying on
 * before `settled` existed.
 */
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
    // THE FINDING, HELD AS A CLAIM: the provider is up and its key is behind the
    // door, and the plugin that named it has not finished starting.
    expect(yield* provider.report).toEqual({ state: "running" })
    expect(yield* consumer.report).toEqual({ state: "waiting" })
    expect(lines).toEqual([])

    yield* settled(host, ["provider", "consumer"])
    expect(yield* consumer.report).toEqual({ state: "running" })
    expect(lines).toEqual(["provider: bumped"])
  })))
})

/**
 * ...AND THE CASCADE, BOTH WAYS — a provider that leaves takes its dependents
 * down, and one that comes back brings them up again, from scratch.
 *
 * The replaced-provider case above asks this of a COMPOSITION ROOT's provision,
 * which is there before anything is mounted. This asks it of a PLUGIN's, which
 * is what a row standing behind a door is, and the answer a plugin owes because
 * of it is not idempotence: it is that an `apply` must be re-runnable from
 * scratch after its previous scope has closed. The assertion is the whole list
 * in order, because "the finalizer ran BEFORE the second apply" is a fact about
 * the sequence and not about the multiset.
 *
 * THE DOWN NEEDS NO SETTLE and the UP DOES, which is worth knowing rather than
 * hiding behind one call: revoking a service awaits every dependent fiber's
 * unload, so the provider's own disposer does not answer until the finalizers
 * have run — while nothing awaits the reload the provision triggers on the way
 * back in.
 */
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
    // The mount awaited the PROVIDER; the dependent is a turn behind it, and
    // without the line below the list is read one entry short.
    yield* settled(host, ["provider", "dependent"])
    expect(lines).toEqual(["dependent: up", "dependent: down", "dependent: up"])
  })))
})

test("a plugin with Config is handed the decoded value, and invalid config fails with a sentence", async () => {
  let seen: unknown
  const plugin = definePlugin({
    name: "scribe",
    needs: [],
    config: Schema.Struct({
      commit: Schema.optionalKey(Schema.Literals(["off", "manual", "auto"])),
    }),
    apply: (config) => Effect.sync(() => {
      seen = config
    }),
  })
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    yield* mountPlugin(host, plugin)
  })))
  expect(seen).toEqual({})

  const standard = (plugin.Config as {
    readonly "~standard": { readonly validate: (value: unknown) => { readonly issues?: unknown } }
  })["~standard"]
  expect(standard.validate({ commit: "auto" }).issues).toBeUndefined()
  expect(standard.validate({ commit: "nope" }).issues).toBeDefined()
})
