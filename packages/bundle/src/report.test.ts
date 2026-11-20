import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import {
  definePlugin,
  mountPlugin,

  serviceTag,
  standing,
} from "@olai/plugin-api/services"
import { provide, settled } from "@olai/effect-cordis"
import { expect, test } from "bun:test"
import { Effect, Scope } from "effect"

import { reportBundle } from "./bundle.ts"
import { BUNDLE_NAMES } from "./rows.ts"

const [FIRST, SECOND] = BUNDLE_NAMES
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("this suite needs a build with two rows")
}

const NOBODY_PROVIDES = serviceTag<{ readonly nothing: true }>("nothingProvidesThis")

const A_SIBLING_PROVIDES = serviceTag<{ readonly something: true }>("aSiblingProvidesThis")

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

test("a row nothing mounted reads as off", async () => {
  const report = await mounted([])
  expect([...report.keys()]).toEqual([...BUNDLE_NAMES])
  expect([...report.values()].every((one) => one.state === "off")).toBe(true)
})

test("a row whose start failed reads as failed, in the plugin's own words", async () => {
  const report = await mounted([
    definePlugin({
      name: FIRST,
      needs: [],
      apply: Effect.die(new Error("no socket at /run/nothing")),
    }),
  ])
  expect(report.get(FIRST)).toEqual({ state: "failed", fault: "no socket at /run/nothing" })
  expect(report.get(SECOND)).toEqual({ state: "off" })
})

test("a failure with nothing to say carries no sentence at all", async () => {
  const report = await mounted([
    definePlugin({ name: FIRST, needs: [], apply: Effect.die(new Error("")) }),
  ])
  expect(report.get(FIRST)).toEqual({ state: "failed" })
})

test("a row that mounted reads as running", async () => {
  const report = await mounted([definePlugin({ name: FIRST, needs: [], apply: Effect.void })])
  expect(report.get(FIRST)).toEqual({ state: "running" })
})

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

test("a row whose sibling provides what it names reads as running", async () => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: SECOND,
      needs: [A_SIBLING_PROVIDES],
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
