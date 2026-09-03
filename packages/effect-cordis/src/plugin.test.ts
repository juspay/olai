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
 */

import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { definePlugin, PluginName } from "./plugin.ts"
import { mountPlugin, openHost, provide } from "./host.ts"
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
    expect(yield* mounted.report).toEqual({ state: "waiting" })
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
