import { afterEach, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { probing } from "./probe.ts"
import { openScratch } from "./scratch.ts"

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "browser-probe-test-")); dirs.push(dir)
  const exe = join(dir, "mcp")
  writeFileSync(exe, `#!${process.execPath}\nimport { serveFake } from ${JSON.stringify(join(import.meta.dirname, "testlib/fake-browser-mcp.ts"))}; serveFake()\n`, { mode: 0o700 })
  return { dir, exe }
}
const probe = (exe: string | undefined, output: string, mode = "good", timeout = 2000) => Effect.runPromise(Effect.scoped(probing({ OLAI_BROWSER_MCP: exe, FAKE_BROWSER_MODE: mode }, output, timeout)))
test("hands over the absolute answering executable with isolated headless scratch arguments", async () => {
  const { dir, exe } = fixture()
  expect(await probe(exe, dir)).toEqual({ server: { name: "browser", command: exe, args: ["--headless", "--isolated", "--output-dir", dir], env: {} }, missing: null })
})
test("unset and explicitly empty knobs are ordinary absence", async () => {
  for (const exe of [undefined, "", "  "]) expect(await probe(exe, "/unused")).toEqual({ server: null, missing: null })
})
test("non-executable, missing, directory and relative commands produce the complete sentence", async () => {
  const { dir, exe } = fixture(); chmodSync(exe, 0o600)
  for (const path of [exe, dir, join(dir, "absent"), "relative"]) {
    const answer = await probe(path, dir)
    expect(answer.server).toBeNull()
    expect(answer.missing?.why).toBe("Browser tools are unavailable because OLAI_BROWSER_MCP does not name an absolute executable file.")
  }
})
test.each([
  ["missing", "missing browser_navigate"],
  ["garbage", "did not speak the expected MCP protocol"],
  ["hang", "did not answer MCP within"],
  ["closed", "closed the MCP connection"],
])("%s cannot be handed to an engine", async (mode, sentence) => {
  const { dir, exe } = fixture(); const answer = await probe(exe, dir, mode, 1500)
  expect(answer.server).toBeNull(); expect(answer.missing?.why).toContain(sentence)
})
test("scratch is private, isolated per activation, and removed with each owner", async () => {
  const { dir } = fixture()
  let first = ""
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    first = yield* openScratch(dir)
    expect(statSync(first).mode & 0o777).toBe(0o700)
    yield* Effect.scoped(Effect.gen(function*() {
      const second = yield* openScratch(dir)
      expect(second).not.toBe(first)
      writeFileSync(join(second, "shot.png"), "spill")
    }))
    expect(existsSync(first)).toBe(true)
  })))
  expect(existsSync(first)).toBe(false)
})
