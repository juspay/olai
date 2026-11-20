import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { provide, settled } from "@olai/effect-cordis"
import { flipRow, mountRows } from "@olai/effect-cordis/loader"
import {
  definePlugin,
  type Host,

  type Plugin,
  rowReport,
  serviceTag,
  standing,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

const DOOR = serviceTag<{ readonly open: Effect.Effect<void> }>("aRowStandsBehindThis")

const UPSTAIRS = "upstairs"
const DOWNSTAIRS = "downstairs"

const pair = (host: Host, said: Array<string>): ReadonlyMap<string, Plugin> =>
  new Map([
    [UPSTAIRS, definePlugin({
      name: UPSTAIRS,
      needs: [],
      apply: provide(host, DOOR, () => ({
        open: Effect.sync(() => void said.push("the door was opened")),
      })),
    })],
    [DOWNSTAIRS, definePlugin({
      name: DOWNSTAIRS,
      needs: [DOOR],
      apply: Effect.flatMap(DOOR, (door) => door.open),
    })],
  ])

const BUNDLE = `- id: ${UPSTAIRS}\n  name: ${UPSTAIRS}\n- id: ${DOWNSTAIRS}\n  name: ${DOWNSTAIRS}\n`

const booted = async (dir: string, said: Array<string>) => {
  writeFileSync(join(dir, "olai.yml"), BUNDLE)
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  const rows = pair(opened.host, said)
  await run(mountRows(opened.host, {
    baseUrl: pathToFileURL(join(dir, "/")).href,
    path: "olai.yml",
    patches: [],
    resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
  }))
  await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))
  return { run, host: opened.host }
}

const stateOf = (report: ReadonlyMap<string, { readonly state: string }>) => ({
  [UPSTAIRS]: report.get(UPSTAIRS)?.state,
  [DOWNSTAIRS]: report.get(DOWNSTAIRS)?.state,
})

const inADirectory = async (body: (dir: string) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "olai-flip-"))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("turning a row off unloads the rows that named its door, naming the door", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)
    expect(said).toEqual(["the door was opened"])

    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(await run(flipRow(host, UPSTAIRS, true))).toBe(true)
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "off", [DOWNSTAIRS]: "waiting" })
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
    expect(said).toEqual(["the door was opened"])
  })
})

test("the flip alone has finished unwinding the row it turned off", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    await run(flipRow(host, UPSTAIRS, true))

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(report.get(DOWNSTAIRS)).toEqual({
      state: "waiting",
      missing: ["aRowStandsBehindThis"],
    })
  })
})

test("turning it back on re-applies the rows that were waiting on it", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    await run(flipRow(host, UPSTAIRS, true))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    await run(flipRow(host, UPSTAIRS, false))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened", "the door was opened"])
  })
})

test("a flip writes nothing — the bundle file is byte-identical after both directions", async () => {
  await inADirectory(async (dir) => {
    const at = join(dir, "olai.yml")
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)

    await run(flipRow(host, UPSTAIRS, true))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)

    await run(flipRow(host, UPSTAIRS, false))
    await run(settled(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(readFileSync(at, "utf8")).toBe(BUNDLE)
  })
})

test("a row this build does not have answers no, and moves nothing", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    const { run, host } = await booted(dir, said)

    expect(await run(flipRow(host, "no-such-row", true))).toBe(false)

    const report = await run(rowReport(host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(report)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened"])
  })
})

test("a disabled provider can be enabled, and its dependants start", async () => {
  await inADirectory(async (dir) => {
    const said: Array<string> = []
    writeFileSync(join(dir, "olai.yml"), BUNDLE)
    const run = standing()
    const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
    const rows = pair(opened.host, said)
    await run(mountRows(opened.host, {
      baseUrl: pathToFileURL(join(dir, "/")).href,
      path: "olai.yml",
      patches: [{ id: UPSTAIRS, disabled: true }, { id: DOWNSTAIRS, disabled: false }],
      resolve: (specifier) => Promise.resolve({ default: rows.get(specifier) }),
    }))
    await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))

    const before = await run(rowReport(opened.host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(before)).toEqual({ [UPSTAIRS]: "off", [DOWNSTAIRS]: "waiting" })
    expect(said).toEqual([])

    expect(await run(flipRow(opened.host, UPSTAIRS, false))).toBe(true)
    await run(settled(opened.host, [UPSTAIRS, DOWNSTAIRS]))

    const after = await run(rowReport(opened.host, [UPSTAIRS, DOWNSTAIRS]))
    expect(stateOf(after)).toEqual({ [UPSTAIRS]: "running", [DOWNSTAIRS]: "running" })
    expect(said).toEqual(["the door was opened"])
  })
})

test("a host with no bundle mounted has no row to flip", async () => {
  const run = standing()
  const opened = await run(openPlugins({ vars: {}, now: () => "", served: "/" }))
  expect(await run(flipRow(opened.host, UPSTAIRS, true))).toBe(false)
})
