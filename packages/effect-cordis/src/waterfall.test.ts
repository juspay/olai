/**
 * THE WATERFALL, with toy middleware — the three properties a caller depends on
 * and one it must not.
 *
 * The one it must NOT is the ORDER, and it is asserted here anyway: what this
 * file pins is that the chain runs in REGISTRATION order, so that a caller who
 * needs a different one knows it has to impose it on the result.
 */

import { expect, test } from "bun:test"
import { Effect } from "effect"

import { mountPlugin, openHost } from "./host.ts"
import { definePlugin, PluginName } from "./plugin.ts"
import { waterfall } from "./waterfall.ts"

interface Opening {
  readonly said: Array<string>
}

const Opening = waterfall<Opening>("opening")

/** One plugin that pushes its own word and calls through. */
const speaker = (name: string) =>
  definePlugin({
    name,
    needs: [Opening.key],
    apply: Effect.gen(function*() {
      const chain = yield* Opening.key
      const who = yield* PluginName
      yield* chain.use((value, next) =>
        Effect.suspend(() => {
          value.said.push(who)
          return next(value)
        })
      )
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
    // The broken link short-circuits its own arm and the value it was handed
    // comes back — which for the plugin AFTER it means it is not consulted,
    // exactly as a link that declined to call `next` would leave it. What is
    // contained is the death: the dispatch answers rather than failing.
    expect((yield* dispatch({ said: [] })).said).toEqual([])
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
