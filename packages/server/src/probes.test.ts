/**
 * THE ORDER A SESSION'S SERVERS ARRIVE IN — the claim a re-rolling e2e failure
 * was named after.
 *
 * ## The bug
 *
 * `SessionStart.asking` was collected by dispatching the `chat/session-start`
 * waterfall and handing back the array the listeners had pushed onto, under a
 * comment that said the result came back "in dispatch order, which is
 * registration order, which is the bundle's". The last step does not follow: a
 * listener registers when its plugin's `apply` runs, and a row's `apply` runs
 * when the loader's `import()` for that row resolves. Two rows, two imports,
 * and whichever came back first went first.
 *
 * What that reached was a conversation. The agent reported `servers: [olai odu
 * kolu]` where the same serve had reported `servers: [olai kolu odu]` the run
 * before, and the chips under the panel's header reordered with it — so a
 * scenario asserting the whole line failed on a different scenario each run,
 * which is how an ordering race reads from outside.
 *
 * ## So the claim is the ORDER, held where it can be false
 *
 * Every case below registers the listeners in the WRONG order on purpose —
 * `odu` before `kolu`, a stranger in the middle — because a bench that
 * registered them in the bundle's order would pass over an implementation that
 * imposes nothing at all. That is exactly the bench the old inline collection
 * had: none.
 */

import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { BUNDLE_NAMES } from "@olai/bundle"
import type { Probed } from "@olai/plugin-api"
import { definePlugin, mountPlugin, openPlugins, SessionStart } from "@olai/plugin-api/services"

import { askingAt } from "./probes.ts"

/** A plugin that pushes its one thunk, exactly as `olai-plugin-kolu` and
 *  `olai-plugin-odu` do — the whole of what a server half contributes here. */
const asks = (name: string) =>
  definePlugin({
    name,
    needs: [SessionStart.key],
    apply: Effect.gen(function*() {
      yield* (yield* SessionStart.key).use((start, next) =>
        Effect.suspend(() => {
          // What the thunk ANSWERS is not this module's subject — the ordering
          // happens before any of them is called — so it is the shape's own
          // "nothing to hand over, and no fault in that".
          start.asking.push({
            name,
            ask: async (): Promise<Probed> => ({ server: null, missing: null }),
          })
          return next(start)
        })
      )
    }),
  })

/** A runtime with those plugins mounted, in the order given — which is the
 *  order two dynamic imports came back in, and the thing every case here is
 *  about. */
const mounted = async (names: ReadonlyArray<string>) => {
  const scope = Scope.makeUnsafe()
  const run = <A>(work: Effect.Effect<A, never, Scope.Scope>): Promise<A> =>
    Effect.runPromise(Effect.provideService(work, Scope.Scope, scope))
  const plugins = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const each = new Map<string, { readonly dispose: Effect.Effect<void> }>()
  for (const name of names) each.set(name, await run(mountPlugin(plugins.host, asks(name))))
  return {
    each,
    run,
    asking: (): Promise<ReadonlyArray<{ readonly name: string }>> => run(askingAt(plugins)),
  }
}

/** The bundle's own order, so the expectations below are read from the same
 *  list the implementation is, rather than from a copy of `olai.yml` kept
 *  here — which is the copy this whole module exists to not have.
 *
 *  A build with fewer than two rows has no order for these cases to be about,
 *  so it says so rather than passing vacuously: `undefined` in an expectation
 *  compares equal to `undefined` in an answer, and every case below would go
 *  green over an implementation that sorted nothing. */
const [FIRST, SECOND] = BUNDLE_NAMES
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("probes.test: the bundle has fewer than two rows, so there is no order to hold")
}

/**
 * THE RACE, REPRODUCED — the two rows mounted back to front.
 *
 * This is not a contrived order: it is one of the two orders two concurrent
 * dynamic imports can resolve in, and the one the failing runs happened to get.
 */
test("two plugins that registered back to front are asked in the bundle's order", async () => {
  const half = await mounted([SECOND, FIRST])
  expect((await half.asking()).map((one) => one.name)).toEqual([FIRST, SECOND])
})

/** ...and the order that was already right stays right, so the sort is not
 *  passing by reversing whatever it is handed. */
test("two plugins that registered in the bundle's order are left alone", async () => {
  const half = await mounted([FIRST, SECOND])
  expect((await half.asking()).map((one) => one.name)).toEqual([FIRST, SECOND])
})

/** A NAME THE BUNDLE DOES NOT KNOW GOES LAST, and does not take a row with it.
 *  Unreachable in this build — every fiber is a row — and it is what an
 *  out-of-tree plugin will want the day one can be added: a stranger after
 *  everything the build shipped, rather than dropped or sorted to the front by
 *  an index of `-1`. */
test("a plugin the bundle never named goes last, and the rows keep their order", async () => {
  const half = await mounted(["stranger", SECOND, FIRST])
  expect((await half.asking()).map((one) => one.name)).toEqual([FIRST, SECOND, "stranger"])
})

/** ...AND A PLUGIN THAT LEFT CONTRIBUTES NOTHING, which is the property the
 *  per-session collection exists for and the one a sort must not quietly
 *  restore from the build's list. The bundle NAMES it; this serve is not
 *  running it; it is not in the answer. */
test("a plugin whose fiber is gone is not asked, however the bundle lists it", async () => {
  const half = await mounted([FIRST, SECOND])
  await half.run(half.each.get(FIRST)!.dispose)
  expect((await half.asking()).map((one) => one.name)).toEqual([SECOND])
})
