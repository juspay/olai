/**
 * WHAT BECAME OF EACH ROW, held as claims — the reading a preferences row's word
 * is made of, and the one place a plugin's own failure sentence is picked up off
 * a fiber.
 *
 * `running: false` used to be the whole story a browser was told, and it covered
 * four different mornings: the flag left it out, the build leaves it out until
 * somebody asks, its `apply` failed, or it is still waiting on a service. Only
 * one of those is a fault, and only one of them is something a person can act on.
 * So the composition root sends a WORD beside the boolean, and this file is the
 * half of that word the LOADER can answer — `off`, `waiting`, `failed`,
 * `running` — against real fibers rather than against a description of them.
 *
 * ## What is deliberately NOT here
 *
 * `optIn`. Telling "the row's own default left it off" from "the flag left it
 * off" needs `--plugins`, which is the composition root's and not this package's
 * — the two are the SAME FIELD by the time the loader sees them, which is exactly
 * what makes the patch a patch. `@olai/server`'s `runtime.test.ts` holds that
 * split.
 *
 * ## Why the plugins are mounted by hand rather than through `mountBundle`
 *
 * The report is keyed by ROW ID and reads the registry, so a plugin bound under a
 * row's name is indistinguishable from one the loader mounted — which is the
 * property worth having, because it means the reading does not depend on a
 * private link between two of the pin's packages. Mounting by hand is what lets a
 * case put a row in `failed` on purpose; the bundle's real rows dial real
 * daemons, and a suite that made one of them fail would be a suite that depended
 * on which machine it ran on.
 */

import {
  definePlugin,
  mountPlugin,
  openPlugins,
  serviceTag,
  standing,
} from "@olai/plugin-api/services"
// THE TWO VERBS THE PLUGIN DOOR WITHHOLDS, spent here because the last case
// below is about a row standing BEHIND a key rather than in front of one, and
// there is no way to stage that with what a plugin may spell. `provide` is the
// capability `@olai/plugin-api` hands out on a caller's behalf and `settled` is
// the composition root's; a bench that mounts plugins by hand is already
// standing where both of those are spent for real (`./bundle.ts`).
import { provide, settled } from "@olai/effect-cordis"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { reportBundle } from "./bundle.ts"
import { BUNDLE_NAMES } from "./rows.ts"

/** The first two rows this build has, by id — spelled nowhere, for the reason
 *  every other file in this package spells no plugin's name. */
const [FIRST, SECOND] = BUNDLE_NAMES
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("this suite needs a build with two rows")
}

/** A key nothing provides — what the `waiting` case is short of. It is a TOY,
 *  because the point is the STATE and not which olai service is missing. */
const NOBODY_PROVIDES = serviceTag<{ readonly nothing: true }>("nothingProvidesThis")

/** ...and one a SIBLING ROW provides, which is a different morning entirely: the
 *  same fiber, held on the same kind of key, with a plugin rather than a
 *  composition root behind it. */
const A_SIBLING_PROVIDES = serviceTag<{ readonly something: true }>("aSiblingProvidesThis")

/** One runtime per case, with the plugins this case wants on it. The rows'
 *  reports come back as a plain map, which is what every case reads. */
const mounted = async (
  plugins: ReadonlyArray<Parameters<typeof mountPlugin>[1]>,
): Promise<
  ReadonlyMap<string, {
    readonly state: string
    readonly fault?: string
    readonly missing?: ReadonlyArray<string>
  }>
> => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  for (const plugin of plugins) await run(mountPlugin(opened.host, plugin))
  return run(reportBundle(opened.host))
}

/**
 * A ROW THAT NEVER LOADED IS ABSENT FROM THE REGISTRY, and that absence IS the
 * answer rather than a missing case.
 *
 * The loader does not import a disabled row at all — no fiber, no runtime,
 * nothing to read a state off — which is the same absence the wire, the faces and
 * the kind table already show for it. A report that treated "no runtime" as a
 * hole would have to invent something to put in it.
 */
test("a row nothing mounted reads as off", async () => {
  const report = await mounted([])
  expect([...report.keys()]).toEqual([...BUNDLE_NAMES])
  expect([...report.values()].every((one) => one.state === "off")).toBe(true)
})

/**
 * A ROW WHOSE `apply` FAILED carries the plugin's own words, verbatim.
 *
 * The runtime lands the fiber in `FAILED` having installed nothing, keeps the
 * error PRIVATE, and re-throws it from `await()` — so the only way to the
 * sentence is to ask the fiber for it, which is why this reading is an Effect at
 * all. The message crosses to the panel with nothing composed around it: the
 * failure prose is the plugin's, and core's job is to carry it.
 */
test("a row whose start failed reads as failed, in the plugin's own words", async () => {
  const report = await mounted([
    definePlugin({
      name: FIRST,
      needs: [],
      apply: Effect.die(new Error("no socket at /run/nothing")),
    }),
  ])
  expect(report.get(FIRST)).toEqual({ state: "failed", fault: "no socket at /run/nothing" })
  // ...and the row beside it is untouched: a plugin that failed installs nothing
  // and takes nothing down with it.
  expect(report.get(SECOND)).toEqual({ state: "off" })
})

/**
 * ...AND A FAILURE WITH NO MESSAGE QUOTES NOBODY.
 *
 * `String(reason)` on a bare `Error` puts the word "Error" on screen as if the
 * plugin had said it. The row says a start failed and offers no sentence, which
 * is honest and is the arm a panel draws when there is nothing to quote.
 */
test("a failure with nothing to say carries no sentence at all", async () => {
  const report = await mounted([
    definePlugin({ name: FIRST, needs: [], apply: Effect.die(new Error("")) }),
  ])
  expect(report.get(FIRST)).toEqual({ state: "failed" })
})

/**
 * A ROW THAT MOUNTED READS AS RUNNING — the one arm the composition root then
 * OVERRIDES, and it is worth holding anyway.
 *
 * `running` on the roster is the LIVE reading — what registered a sibling surface
 * — and this is a boot snapshot, so the root lets the live one win. That override
 * is only safe because the two agree on the ordinary path, which is what this
 * case is: a fiber that is ACTIVE is a row that loaded.
 */
test("a row that mounted reads as running", async () => {
  const report = await mounted([definePlugin({ name: FIRST, needs: [], apply: Effect.void })])
  expect(report.get(FIRST)).toEqual({ state: "running" })
})

/**
 * A ROW SHORT OF SOMETHING IT NAMES IS `waiting`, WHICH IS NOT `off` — AND IT
 * SAYS WHAT IT IS SHORT OF.
 *
 * It was asked for and it did load; what it is missing is a service that has not
 * arrived. The KEY comes with the word because the two facts a person needs are
 * on two different rows — this one is waiting, and the one that would have
 * provided is off or failed two lines up — and joining them is a reader's job
 * rather than a general package's. Which row WOULD provide it is the bundle's
 * business and is deliberately not in the answer.
 */
test("a row waiting on a service it names is waiting, not off, and names the key", async () => {
  const report = await mounted([
    definePlugin({
      name: FIRST,
      needs: [NOBODY_PROVIDES],
      apply: Effect.gen(function*() {
        yield* NOBODY_PROVIDES
      }),
    }),
  ])
  expect(report.get(FIRST)).toEqual({ state: "waiting", missing: ["nothingProvidesThis"] })
})

/**
 * ...AND A ROW WAITING ON A SIBLING IS `running` ONCE THE SIBLING HAS PROVIDED.
 *
 * The other half of the state above, and the one the report is about to be asked
 * for a build where a row stands behind a door. The reading has to survive the
 * fiber having gone `PENDING` and come back — the epoch it was held at is a
 * different one from the epoch it runs at — and the mount of the PROVIDER does
 * not cover the dependent's own apply, which is why the settle is between them
 * rather than folded into either.
 */
test("a row whose sibling provides what it names reads as running", async () => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: SECOND,
      needs: [A_SIBLING_PROVIDES],
      // THE SLEEP IS THE SUBJECT: an apply that finishes inside the mount's own
      // microtask chain is read correctly by accident, and every apply in this
      // build did until a row stood behind a door.
      apply: Effect.gen(function*() {
        yield* A_SIBLING_PROVIDES
        yield* Effect.sleep("5 millis")
      }),
    }),
  ))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: FIRST,
      needs: [],
      apply: provide(opened.host, A_SIBLING_PROVIDES, () => ({ something: true as const })),
    }),
  ))
  await run(settled(opened.host, BUNDLE_NAMES))
  const report = await run(reportBundle(opened.host))
  expect(report.get(FIRST)).toEqual({ state: "running" })
  expect(report.get(SECOND)).toEqual({ state: "running" })
})
