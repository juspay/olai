import { expect, test } from "bun:test"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, Fiber } from "effect"
import { makeHimalaya } from "./run.ts"
import { GMAIL } from "./verbs.ts"

test("interrupting a Himalaya call kills and joins its child before cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "mail-child-test-"))
  const pidFile = join(root, "pid")
  const binary = join(root, "himalaya")
  await writeFile(binary, `#!${process.execPath}\nawait Bun.write(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`)
  await chmod(binary, 0o700)
  const runner = makeHimalaya({ binary, env: { XDG_RUNTIME_DIR: root } })
  try {
    await Effect.runPromise(runner.useToken({ token: "test", address: "you@gmail.com" }))
    const fiber = Effect.runFork(runner.run({ verb: GMAIL.threadsGet, args: ["a1"] }))
    try {
      for (let i = 0; i < 200 && !existsSync(pidFile); i++) await new Promise(resolve => setTimeout(resolve, 10))
      expect(existsSync(pidFile)).toBe(true)
      const pid = Number(await readFile(pidFile, "utf8"))
      await Effect.runPromise(Fiber.interrupt(fiber))
      expect(() => process.kill(pid, 0)).toThrow()
    } finally { await Effect.runPromise(Fiber.interrupt(fiber)) }
  } finally {
    await runner.close()
    await rm(root, { recursive: true, force: true })
  }
})

for (const outcome of ["success", "failure", "invalid JSON", "timeout", "interruption"] as const) {
  test(`draft message is private and removed on ${outcome}`, async () => {
    const { readdir, stat } = await import("node:fs/promises")
    const { spyOn } = await import("bun:test")
    const root = await mkdtemp(join(tmpdir(), "mail-message-test-"))
    const report = join(root, "report")
    const binary = join(root, "himalaya")
    const script = `#!${process.execPath}
const file = process.argv.at(-1);
await Bun.write(${JSON.stringify(report)}, JSON.stringify({ file, text: await Bun.file(file).text(), args: process.argv.slice(2) }));
${outcome === "timeout" || outcome === "interruption" ? 'setInterval(() => {}, 1000)' : outcome === "failure" ? 'console.log(JSON.stringify({error:"404 not found"})); process.exitCode = 1' : outcome === "invalid JSON" ? 'console.log("oops")' : 'console.log(JSON.stringify({id:"draft_1"}))'}
`
    await writeFile(binary, script)
    await chmod(binary, 0o700)
    const runner = makeHimalaya({ binary, env: { XDG_RUNTIME_DIR: root } })
    const timeout = AbortSignal.timeout.bind(AbortSignal)
    const spy = outcome === "timeout" ? spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(500)) : undefined
    try {
      await Effect.runPromise(runner.useToken({ token: "test", address: "you@gmail.com" }))
      const directory = join(root, (await readdir(root)).find(file => file.startsWith("olai-mail-"))!)
      expect((await stat(directory)).mode & 0o777).toBe(0o700)
      const fiber = Effect.runFork(Effect.result(runner.run({ verb: GMAIL.draftsCreate, message: "literal \\n\r\nmessage" })))
      try {
        for (let i = 0; i < 200 && !existsSync(report); i++) await new Promise(resolve => setTimeout(resolve, 10))
        expect(existsSync(report)).toBe(true)
        const recorded = JSON.parse(await readFile(report, "utf8"))
        expect(recorded.text).toBe("literal \\n\r\nmessage")
        expect(recorded.args.at(-2)).toBe("--")
        if (outcome === "interruption" || outcome === "timeout") expect((await stat(recorded.file)).mode & 0o777).toBe(0o600)
        if (outcome === "interruption") await Effect.runPromise(Fiber.interrupt(fiber))
        else {
          const result = await Effect.runPromise(Fiber.join(fiber))
          expect(result._tag).toBe(outcome === "success" ? "Success" : "Failure")
          if (outcome === "timeout" && result._tag === "Failure") expect(result.failure.reason).toContain("did not answer within")
        }
        expect(existsSync(recorded.file)).toBe(false)
        expect(await readdir(directory)).toEqual(["config.toml"])
      } finally { await Effect.runPromise(Fiber.interrupt(fiber)) }
      await runner.close()
      expect(existsSync(directory)).toBe(false)
    } finally { spy?.mockRestore(); await runner.close(); await rm(root, { recursive: true, force: true }) }
  })
}
