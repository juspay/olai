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
