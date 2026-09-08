import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { balance, isTest, shardSettings, timingsFromLogs } from "./test-shards.mjs"

test("long files go to the least loaded shard, rather than equal file counts", () => {
  const weights = { a: 9, b: 1, c: 8, d: 1, e: 7, f: 1 }
  const shards = balance(Object.keys(weights), weights, 3)
  expect(shards.map(s => s.ms)).toEqual([9, 9, 9])
})

test.each([1, 2, 6, 10])("%i shards cover every file exactly once, including unknown and browser tests", total => {
  const files = ["a.test.ts", "b.browsertest.ts", "new.test.ts", "c.test.ts"]
  const timings = { "a.test.ts": 2000, "b.browsertest.ts": 3000, "c.test.ts": 0, "deleted.test.ts": 99999 }
  const result = balance(files, timings, total)
  expect(result.flatMap(s => s.files).sort()).toEqual(files.toSorted())
  expect(result.reduce((n, s) => n + s.ms, 0)).toBe(6001)
  expect(balance(files.toReversed(), timings, total)).toEqual(result)
})

test("recorded timings distinguish suites and combine case times within each file", () => {
  expect(timingsFromLogs([
    "a.test.ts:\n(pass) one [100.50ms]\n(pass) two [200.00ms]\nb.browsertest.ts:\n(pass) three [50.00ms]",
  ])).toEqual({ "a.test.ts": 301, "b.browsertest.ts": 50 })
  expect(() => timingsFromLogs(["no timings"])).toThrow()
})

test("invalid settings and corrupt timings fail rather than silently skip work", () => {
  for (const env of [{}, { ODU_SHARD_INDEX: "0" }, { ODU_SHARD_INDEX: "2", ODU_SHARD_TOTAL: "2" },
    { ODU_SHARD_INDEX: "0", ODU_SHARD_TOTAL: "0" }, { ODU_SHARD_INDEX: "01", ODU_SHARD_TOTAL: "2" }]) {
    expect(() => shardSettings(env)).toThrow()
  }
  expect(shardSettings({ ODU_SHARD_INDEX: "0", ODU_SHARD_TOTAL: "1" })).toEqual({ index: 0, total: 1 })
  expect(() => balance(["a"], { a: -1 }, 2)).toThrow()
  expect(() => balance(["a"], { a: "1" }, 2)).toThrow()
})

test("discovery recognizes the existing Bun filename conventions", () => {
  for (const file of ["a.test.ts", "a_test.js", "a.spec.tsx", "a_spec.jsx", "a.browsertest.ts"])
    expect(isTest(file)).toBe(true)
  for (const file of ["a.testlib.ts", "a.ts", "a.bench.ts", ""])
    expect(isTest(file)).toBe(false)
})

test("the runner uses tracked discovery, browser conditions, and propagates failures", () => {
  const root = mkdtempSync(join(tmpdir(), "olai-test-shards-"))
  try {
    mkdirSync(join(root, "scripts"))
    copyFileSync(join(import.meta.dirname, "test-shards.mjs"), join(root, "scripts/test-shards.mjs"))
    writeFileSync(join(root, "scripts/test-timings.json"), "{}")
    // A self-reference verifies the actual Bun resolution condition in each run.
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", exports: {
      ".": { browser: "./browser.js", default: "./server.js" },
    } }))
    writeFileSync(join(root, "browser.js"), 'export default "browser"')
    writeFileSync(join(root, "server.js"), 'export default "server"')
    for (const [file, mode] of [["normal.test.ts", "server"], ["reactive.browsertest.ts", "browser"]]) {
      writeFileSync(join(root, file), `import {test,expect} from "bun:test"; import mode from "fixture"; test("${mode}",()=>expect(mode).toBe("${mode}"))`)
    }
    for (const args of [["init", "-q"], ["add", "."]]) {
      expect(spawnSync("git", args, { cwd: root }).status).toBe(0)
    }
    writeFileSync(join(root, "untracked.test.ts"), 'throw new Error("must not run")')
    const run = (index = "0", total = "1") => spawnSync(process.execPath, ["scripts/test-shards.mjs"], {
      cwd: root, encoding: "utf8", env: { ...process.env, ODU_SHARD_INDEX: index, ODU_SHARD_TOTAL: total },
    })
    const passed = run()
    expect(passed.status).toBe(0)
    expect(passed.stderr).toContain("(pass) server")
    expect(passed.stderr).toContain("(pass) browser")
    expect(run("2", "3").status).toBe(0) // No tests assigned; do not invoke Bun discovery.
    writeFileSync(join(root, "normal.test.ts"), 'import {test,expect} from "bun:test"; test("failure",()=>expect(1).toBe(2))')
    expect(run().status).not.toBe(0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
