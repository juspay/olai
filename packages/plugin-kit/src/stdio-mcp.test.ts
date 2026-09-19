import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, Fiber } from "effect"
import { askStdioMcp } from "./stdio-mcp.ts"
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
const fixture = (body: string) => {
  const dir = mkdtempSync(join(tmpdir(), "stdio-mcp-test-")); dirs.push(dir)
  const script = join(dir, "server.js"); writeFileSync(script, body)
  return { dir, options: { command: process.execPath, args: [script], timeout: 500 } }
}
test("a spawn failure is evidence, not an unhandled child error", async () => {
  const answer = await Effect.runPromise(Effect.scoped(askStdioMcp({ command: "/no-such-mcp", args: [], timeout: 500 })))
  expect(answer._tag).toBe("couldNotStart")
})
test.each(["null", "[]", '{"jsonrpc":"2.0","id":2,"result":{"tools":42}}'])("malformed JSON shape %s is refused", async line => {
  const { options } = fixture(`process.stdout.write(${JSON.stringify(line + '\n')});setInterval(()=>{},1000)`)
  expect((await Effect.runPromise(Effect.scoped(askStdioMcp(options))))._tag).toBe("failed")
})
test("scope interruption joins a hung child, even if it ignores SIGTERM", async () => {
  const { dir, options } = fixture(`require('node:fs').writeFileSync(process.argv[2],String(process.pid));process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`)
  const pidFile = join(dir, "pid")
  await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const child = yield* Effect.forkChild(Effect.scoped(askStdioMcp({ ...options, args: [...options.args, pidFile], timeout: 10000 })))
    yield* Effect.promise(async () => {
      for (let n = 0; !existsSync(pidFile) && n < 100; n++) await new Promise(r => setTimeout(r, 10))
      expect(existsSync(pidFile)).toBe(true)
    })
    yield* Fiber.interrupt(child)
    expect(() => process.kill(Number(readFileSync(pidFile, "utf8")), 0)).toThrow()
  })))
})
