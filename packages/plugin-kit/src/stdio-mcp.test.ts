import { afterEach, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Cause, Effect, Exit, Fiber } from "effect"
import { askStdioMcp } from "./stdio-mcp.ts"

// Each fixture is a process speaking over real pipes; its directory belongs
// to the test and its process belongs to the transport scope.
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const fixture = (body: string) => {
  const dir = mkdtempSync(join(tmpdir(), "stdio-mcp-test-"))
  dirs.push(dir)
  const script = join(dir, "server.js")
  writeFileSync(script, body)
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
  const { dir, options } = fixture(`
    require("node:fs").writeFileSync(process.argv[2], String(process.pid))
    process.on("SIGTERM", () => {})
    setInterval(() => {}, 1000)
  `)
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

test("a silent peer times out, while non-protocol output fails immediately", async () => {
  const silent = fixture("setInterval(() => {}, 1000)")
  const waiting = await Effect.runPromise(Effect.scoped(askStdioMcp(silent.options)))
  expect(waiting).toEqual({ _tag: "timedOut", deadlineMs: 500, stderr: "" })

  const noisy = fixture('process.stdout.write("not JSON-RPC\\n"); setInterval(() => {}, 1000)')
  const failed = await Effect.runPromise(Effect.scoped(askStdioMcp(noisy.options)))
  expect(failed._tag).toBe("failed")
  if (failed._tag === "failed") expect(failed.cause).toContain("not JSON-RPC")
})

test("a startup failure retains only the bounded stderr tail for its caller", async () => {
  const { options } = fixture(`
    process.stderr.write("x".repeat(16000) + "startup reason", () => process.exit(1))
  `)
  const answer = await Effect.runPromise(Effect.scoped(askStdioMcp(options)))
  expect(answer._tag).toBe("closed")
  expect(answer.stderr.length).toBe(8192)
  expect(answer.stderr.endsWith("startup reason")).toBe(true)
})

test("notifications do not answer the question and paginated tools arrive whole", async () => {
  const { options } = fixture(`
    require("node:readline").createInterface({ input: process.stdin }).on("line", line => {
      const message = JSON.parse(line)
      if (message.id === undefined) return
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/message" }) + "\\n")
      const tool = name => ({ name, inputSchema: { type: "object", properties: { aim: {} } } })
      const result = message.id === 1 ? { protocolVersion: "2025-06-18" }
        : message.params?.cursor === "second" ? { tools: [tool("two")] }
        : { tools: [tool("one")], nextCursor: "second" }
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n")
    })
  `)
  const answer = await Effect.runPromise(Effect.scoped(askStdioMcp(options)))
  expect(answer).toEqual({
    _tag: "answered", stderr: "",
    tools: [{ name: "one", inputs: ["aim"] }, { name: "two", inputs: ["aim"] }],
  })
})


test("a synchronous spawn exception is classified only at the spawn boundary", async () => {
  const answer = await Effect.runPromise(Effect.scoped(askStdioMcp({
    command: "invalid\0command", args: [], timeout: 500,
  })))
  expect(answer._tag).toBe("couldNotStart")
})


test("an interrogation defect is not reported as an OS spawn failure", async () => {
  const { options } = fixture("setInterval(() => {}, 1000)")
  const exit = await Effect.runPromise(Effect.exit(Effect.scoped(askStdioMcp({
    ...options,
    get timeout(): number { throw new Error("interrogation bug") },
  }))))
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.pretty(exit.cause)).toContain("interrogation bug")
})
