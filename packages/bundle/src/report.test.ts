/**
 * WHAT BECAME OF EACH ROW, held as claims — the reading a preferences row's
 * word is made of, and the one place a plugin's own failure sentence is picked
 * up off a fiber.
 *
 * `running: false` used to be the whole story a browser was told, and it covered
 * four different mornings: the flag left it out, the build leaves it out until
 * somebody asks, its `apply` threw, or it is still waiting on a service. Only
 * one of those is a fault, and only one of them is something a person can act
 * on. So the composition root sends a WORD beside the boolean, and this file is
 * the half of that word the LOADER can answer — `off`, `waiting`, `failed`,
 * `running` — against real Cordis fibers rather than against a description of
 * them.
 *
 * ## What is deliberately NOT here
 *
 * `optIn`. Telling "the row's own default left it off" from "the flag left it
 * off" needs `--plugins`, which is the composition root's and not this
 * package's — the two are the SAME FIELD by the time the loader sees them,
 * which is exactly what makes the patch a patch. `@olai/server`'s
 * `runtime.test.ts` holds that split.
 *
 * ## Why the fibers are mounted by hand rather than through `mountBundle`
 *
 * The report is keyed by ROW ID and reads the registry, so a fiber bound under
 * a row's name is indistinguishable from one the loader mounted — which is the
 * property worth having, because it means the reading does not depend on a
 * private link between two of the pin's packages. Mounting by hand is what lets
 * a case put a row in `FAILED` on purpose; the bundle's real rows dial real
 * daemons, and a suite that made one of them throw would be a suite that
 * depended on which machine it ran on.
 */

import { Context } from "cordis"
import { expect, test } from "bun:test"

import { BUNDLE_NAMES, reportBundle } from "./bundle.ts"

/** The first two rows this build has, by id — spelled nowhere, for the reason
 *  every other file in this package spells no plugin's name. */
const [FIRST, SECOND] = BUNDLE_NAMES
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("this suite needs a build with two rows")
}

/**
 * A ROW THAT NEVER LOADED IS ABSENT FROM THE REGISTRY, and that absence IS the
 * answer rather than a missing case.
 *
 * The loader does not import a disabled row at all — no fiber, no runtime,
 * nothing to read a state off — which is the same absence the wire, the faces
 * and the kind table already show for it. A report that treated "no runtime" as
 * a hole would have to invent something to put in it.
 */
test("a row nothing mounted reads as off", async () => {
  const report = await reportBundle(new Context())
  expect([...report.keys()]).toEqual([...BUNDLE_NAMES])
  expect([...report.values()].every((one) => one.state === "off")).toBe(true)
})

/**
 * A ROW WHOSE `apply` THREW carries the plugin's own words, verbatim.
 *
 * Cordis lands the fiber in `FAILED` having installed nothing, keeps the error
 * PRIVATE, and re-throws it from `await()` — so the only way to the sentence is
 * to ask the fiber for it, which is why this reading is async at all. The
 * message crosses to the panel with nothing composed around it: the failure
 * prose is the plugin's, and core's job is to carry it.
 */
test("a row whose start threw reads as failed, in the plugin's own words", async () => {
  const ctx = new Context()
  await ctx.plugin({
    name: FIRST,
    apply: () => {
      throw new Error("no socket at /run/nothing")
    },
  }).then(() => {}, () => {})
  const report = await reportBundle(ctx)
  expect(report.get(FIRST)).toEqual({ state: "failed", fault: "no socket at /run/nothing" })
  // ...and the row beside it is untouched: a fiber that failed installs
  // nothing and takes nothing down with it.
  expect(report.get(SECOND)).toEqual({ state: "off" })
})

/**
 * ...AND A THROW WITH NO MESSAGE QUOTES NOBODY.
 *
 * `String(reason)` on a bare `Error` puts the word "Error" on screen as if the
 * plugin had said it. The row says a start threw and offers no sentence, which
 * is honest and is the arm a panel draws when there is nothing to quote.
 */
test("a throw with nothing to say carries no sentence at all", async () => {
  const ctx = new Context()
  await ctx.plugin({
    name: FIRST,
    apply: () => {
      throw new Error("")
    },
  }).then(() => {}, () => {})
  expect(report(await reportBundle(ctx))).toEqual({ state: "failed" })
})

/**
 * A ROW THAT MOUNTED READS AS RUNNING — the one arm the composition root then
 * OVERRIDES, and it is worth holding anyway.
 *
 * `running` on the roster is the LIVE reading — what registered a sibling
 * surface — and this is a boot snapshot, so the root lets the live one win.
 * That override is only safe because the two agree on the ordinary path, which
 * is what this case is: a fiber that is ACTIVE is a row that loaded.
 */
test("a row that mounted reads as running", async () => {
  const ctx = new Context()
  await ctx.plugin({ name: FIRST, apply: () => {} })
  expect(report(await reportBundle(ctx))).toEqual({ state: "running" })
})

/**
 * A ROW SHORT OF SOMETHING IT INJECTS IS `waiting`, WHICH IS NOT `off`.
 *
 * It was asked for and it did load; what it is missing is a service that has
 * not arrived. Nothing in this phase can produce that state at a serve — every
 * service a plugin injects is mounted before the bundle is — and the runtime
 * that CAN produce it is the one already running, so the word exists rather
 * than the state being unrepresentable the day something does.
 */
test("a row waiting on a service it injects is waiting, not off", async () => {
  const ctx = new Context()
  void ctx.plugin({ name: FIRST, inject: ["nothingProvidesThis"], apply: () => {} })
  expect(report(await reportBundle(ctx))).toEqual({ state: "waiting" })
})

/** The first row's report — the one every case above is about. */
const report = (table: Awaited<ReturnType<typeof reportBundle>>) => table.get(FIRST)
