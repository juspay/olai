import { afterEach, expect, test } from "bun:test"
import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Fiber, Scope, Exit } from "effect"
import { probing } from "./probe.ts"
import { ownProbe } from "./owned.ts"
import { openScratch } from "./scratch.ts"

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "browser-probe-test-"))
  dirs.push(dir)
  const exe = join(dir, "mcp")
  writeFileSync(exe, `#!${process.execPath}\nimport { serveFake } from ${JSON.stringify(join(import.meta.dirname, "testlib/fake-browser-mcp.ts"))}; serveFake()\n`, { mode: 0o700 })
  return { dir, exe }
}
const probe = (exe: string | undefined, output: string, mode = "good", timeout = 2000) => Effect.runPromise(Effect.scoped(probing({ OLAI_BROWSER_MCP: exe, FAKE_BROWSER_MODE: mode }, output, timeout)))
test("hands over the absolute answering executable with isolated headless scratch arguments", async () => {
  const { dir, exe } = fixture()
  const answer = await probe(exe, dir)
  const output = answer.server?.args[3]!
  expect(output.startsWith(join(dir, "conversation-"))).toBe(true)
  expect(statSync(output).mode & 0o777).toBe(0o700)
  expect(answer).toEqual({
    server: { name: "browser", command: exe, args: ["--headless", "--isolated", "--output-dir", output], env: {} },
    missing: null,
  })
})
test("unset and explicitly empty knobs are ordinary absence", async () => {
  for (const exe of [undefined, "", "  "]) expect(await probe(exe, "/unused")).toEqual({ server: null, missing: null })
})
test("non-executable, missing, directory and relative commands produce the complete sentence", async () => {
  const { dir, exe } = fixture()
  chmodSync(exe, 0o600)
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
  const { dir, exe } = fixture()
  const answer = await probe(exe, dir, mode, 1500)
  expect(answer.server).toBeNull()
  expect(answer.missing?.why).toContain(sentence)
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


test("two handoffs claim different directories; failed probes claim none", async () => {
  const { dir, exe } = fixture()
  let outputs: string[] = []
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const scratch = yield* openScratch(dir)
    const failed = yield* Effect.promise(() => probe(exe, scratch, "missing"))
    expect(failed.server).toBeNull()
    expect(readdirSync(scratch)).toEqual([])
    for (let n = 0; n < 2; n++) {
      const answer = yield* Effect.promise(() => probe(exe, scratch))
      outputs.push(answer.server!.args[3]!)
    }
    expect(new Set(outputs).size).toBe(2)
    for (const output of outputs) expect(statSync(output).mode & 0o777).toBe(0o700)
  })))
  for (const output of outputs) expect(existsSync(output)).toBe(false)
})

test("withdrawal joins a running probe before scratch closes and refuses a stale snapshot", async () => {
  const { dir, exe } = fixture()
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const row = yield* Scope.make()
    const scratch = yield* openScratch(dir).pipe(Effect.provideService(Scope.Scope, row))
    const ask = yield* ownProbe(Effect.scoped(probing({
      OLAI_BROWSER_MCP: exe, FAKE_BROWSER_MODE: "hang", XDG_RUNTIME_DIR: dir,
    }, scratch))).pipe(Effect.provideService(Scope.Scope, row))
    const opening = yield* Effect.forkChild(ask)
    const log = join(dir, "browser-probes.log")
    yield* Effect.promise(async () => {
      for (let n = 0; !existsSync(log) && n < 100; n++) await new Promise(resolve => setTimeout(resolve, 10))
    })
    expect(existsSync(log)).toBe(true)
    const { pid } = JSON.parse(readFileSync(log, "utf8").trim())
    yield* Scope.close(row, Exit.void)
    expect(yield* Fiber.join(opening)).toEqual({ server: null, missing: null })
    expect(existsSync(scratch)).toBe(false)
    expect(() => process.kill(pid, 0)).toThrow()
    expect(yield* ask).toEqual({ server: null, missing: null })
    expect(existsSync(scratch)).toBe(false)
  })))
})

test("an unexpected preparation defect becomes a missing sentence", async () => {
  const { dir, exe } = fixture()
  const answer = await probe(exe, join(dir, "no-parent"))
  expect(answer.server).toBeNull()
  expect(answer.missing?.why).toContain("Browser tools could not be prepared:")
})
