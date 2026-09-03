/**
 * THE WATERFALL, with toy middleware — the properties a caller depends on and
 * one it must not.
 *
 * The one it must NOT is the ORDER, and it is asserted here anyway: what this
 * file pins is that the chain runs in REGISTRATION order, so that a caller who
 * needs a different one knows it has to impose it on the result.
 *
 * TWO OF THEM ARE ABOUT A DYING LINK, and they are the two halves of one rule:
 * a link that dies without calling through has not consulted the rest of the
 * chain, so the rest is still asked; a link that dies after calling through has
 * already had its answer, so the rest is NOT asked again. Only one of these was
 * here, and it asserted the opposite of what its own title said.
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
    // THE PLUGIN AFTER IT IS STILL ASKED. The dying link never called through,
    // so it has not consulted the rest of the chain and the rest is not its to
    // skip: the dispatch resumes at the next link with the value the broken one
    // was handed. What is contained is the death — the dispatch answers rather
    // than failing — and what is NOT swallowed with it is everybody else's say.
    expect((yield* dispatch({ said: [] })).said).toEqual(["other"])
  })))
})

test("a link that dies AFTER calling through does not re-ask the rest", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const host = yield* openHost
    const dispatch = yield* Opening.open(host)
    // It calls `next` — so "other" below has already had its say — and THEN
    // dies on what it meant to do with the answer. Resuming the chain here
    // would ask "other" a second time, which is the double-ask this waterfall
    // exists to make impossible (a doorbell asked twice starts a daemon twice).
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
    yield* mountPlugin(host, speaker("other"))
    // ONCE. The value comes back as the dying link was handed it — it may have
    // done half of what it meant to, and a half-transformed value is not
    // something to pass on — but "other" ran, and ran exactly one time.
    const opened = yield* dispatch({ said: [] })
    expect(opened.said).toEqual(["other"])
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
