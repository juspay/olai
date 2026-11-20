import { selectFixtureRows } from "./fixture.testlib.ts"
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { provide, settled } from "@olai/effect-cordis"
import { mountRows } from "@olai/effect-cordis/loader"
import {
  definePlugin,
  type Host,
  mountPlugin,

  type Plugin,
  rowReport,
  serviceTag,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import { mountBundle } from "./bundle.ts"
import { BUNDLE_NAMES } from "./rows.ts"

const DOOR = serviceTag<{ readonly open: Effect.Effect<void> }>("aRowStandsBehindThis")

const UPSTAIRS = "upstairs"
const DOWNSTAIRS = "downstairs"

const pair = (host: Host, said: Array<string>): ReadonlyMap<string, Plugin> =>
  new Map([
    [UPSTAIRS, definePlugin({
      name: UPSTAIRS,
      needs: [],
      apply: Effect.gen(function*() {
        yield* Effect.sleep("5 millis")
        yield* provide(host, DOOR, () => ({
          open: Effect.sync(() => void said.push("the door was opened")),
        }))
      }),
    })],
    [DOWNSTAIRS, definePlugin({
      name: DOWNSTAIRS,
      needs: [DOOR],
      apply: Effect.gen(function*() {
        const door = yield* DOOR
        yield* Effect.sleep("5 millis")
        yield* door.open
      }),
    })],
  ])

const bundleAt = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-settle-"))
  writeFileSync(
    join(dir, "olai.yml"),
    `- id: ${UPSTAIRS}\n  name: ${UPSTAIRS}\n- id: ${DOWNSTAIRS}\n  name: ${DOWNSTAIRS}\n`,
  )
  return dir
}

const loaded = async (dir: string, said: Array<string>) => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const rows = pair(opened.host, said)
  await run(mountRows(opened.host, {
    baseUrl: pathToFileURL(join(dir, "/")).href,
    path: "olai.yml",
    patches: [],
    resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
  }))
  return { run, host: opened.host }
}

test("mounting the rows alone leaves a row waiting on its sibling still applying", async () => {
  const dir = bundleAt()
  try {
    const said: Array<string> = []
    const { run, host } = await loaded(dir, said)
    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(report.get(UPSTAIRS)).toEqual({ state: "waiting" })
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
    expect(said).toEqual([])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("every row is running, and has applied, once the mount has settled", async () => {
  const dir = bundleAt()
  try {
    const said: Array<string> = []
    const { run, host } = await loaded(dir, said)
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(report.get(UPSTAIRS)).toEqual({ state: "running" })
    expect(report.get(DOWNSTAIRS)).toEqual({ state: "running" })
    expect(said).toEqual(["the door was opened"])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("mountBundle returns with a row's sibling-woken apply already finished", async () => {
  const [first, second] = BUNDLE_NAMES
  if (first === undefined || second === undefined) {
    throw new Error("this suite needs a build with two rows")
  }
  const said: Array<string> = []
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: second,
      needs: [DOOR],
      apply: Effect.gen(function*() {
        const door = yield* DOOR
        yield* Effect.sleep("100 millis")
        yield* door.open
      }),
    }),
  ))
  await run(mountPlugin(
    opened.host,
    definePlugin({
      name: first,
      needs: [],
      apply: provide(opened.host, DOOR, () => ({
        open: Effect.sync(() => void said.push("the door was opened")),
      })),
    }),
  ))
  expect(said).toEqual([])

  await run(mountBundle(opened.host, selectFixtureRows([])))
  expect(said).toEqual(["the door was opened"])
  const report = await run(rowReport(opened.host, [first, second]))
  expect(report.get(second)).toEqual({ state: "running" })
})
