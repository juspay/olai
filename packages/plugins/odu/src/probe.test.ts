import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Fiber } from "effect"

import { ODU_COMMAND, type Probed, probing } from "./probe.ts"

const probe = (env: Record<string, string | undefined>): Promise<Probed> =>
  Effect.runPromise(Effect.scoped(probing(env)))

const made: Array<string> = []

let where = ""

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
  where = ""
})

const oduOnPath = (body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-odu-"))
  made.push(dir)
  where = dir
  const bin = join(dir, ODU_COMMAND)
  writeFileSync(bin, `#!${process.execPath}\n${body}`)
  chmodSync(bin, 0o755)
  return bin
}

const answering = (answers: Record<number, unknown>): string => `
  const lines = require("node:readline").createInterface({ input: process.stdin })
  lines.on("line", (line) => {
    if (line.trim() === "") return
    let message
    try { message = JSON.parse(line) } catch { return }
    if (message.method === "notifications/initialized") {
      // Emit one notice of our own: a client that chokes on one has no
      // business being this probe.
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: {} }) + "\\n")
      return
    }
    const answer = ${JSON.stringify(answers)}[message.id]
    if (answer === undefined) return
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: answer }) + "\\n")
  })
`

const tool = (name: string, ...aims: ReadonlyArray<string>): Record<string, unknown> => ({
  name,
  inputSchema: {
    type: "object",
    properties: Object.fromEntries(aims.map((key) => [key, { type: "string" }])),
  },
})

const SURFACE = {
  tools: [
    tool("run_start", "checkout", "expectedSha", "requestId"),
    tool("run_retry", "runId", "selector", "requestId"),
    tool("run_cancel", "runId", "scope", "requestId"),
    tool("run_wait", "runId", "after", "deadlineMs"),
    tool("venue_hold", "checkout", "requestId"),
    tool("venue_release", "checkout", "requestId"),
    tool("run_read", "runId"),
    tool("log_read", "key"),
    tool("pipeline_read", "checkout"),
    tool("venue_probe"),
  ],
}

const SURFACE_BEFORE_105 = {
  tools: [
    tool("run", "checkout"),
    tool("node_rerun", "checkout"),
    tool("node_cancel", "checkout"),
    tool("wait_for_settle", "checkout"),
    tool("lease", "checkout"),
    tool("release", "checkout"),
  ],
}

const handshake = (tools: Record<string, unknown> = SURFACE): Record<number, unknown> => ({
  1: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "odu", version: "0.1.0" } },
  2: tools,
})

describe("odu's mcp, asked for fresh", () => {
  test("no `odu` on the probed PATH is a missing row, never quiet — a packaged olai carries one", async () => {
    const none = mkdtempSync(join(tmpdir(), "olai-odu-"))
    made.push(none)
    const found = await probe({ PATH: none })
    expect(found.server).toBeNull()
    expect(found.missing?.name).toBe("odu")
    expect(found.missing?.where).toBeNull()
    expect(found.missing?.why).toContain("no `odu`")
    expect(found.missing?.why).toContain("PATH")
    expect(found.missing?.why).toContain("a packaged olai carries one")
  })

  test("an answering `odu` with the shape is handed over, by its own resolved path", async () => {
    const bin = oduOnPath(answering(handshake()))
    expect(await probe({ PATH: where })).toEqual({
      server: { name: "odu", command: bin, args: ["mcp"], env: {} },
      missing: null,
    })
  })

  test("a file that is THERE but will not run does not shadow the one behind it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "olai-odu-"))
    made.push(dir)
    const bin = join(dir, ODU_COMMAND)
    writeFileSync(bin, "data: not a program")
    chmodSync(bin, 0o644)
    const good = oduOnPath(answering(handshake()))
    const found = await probe({ PATH: `${dir}${require("node:path").delimiter}${where}` })
    expect(found.server?.command).toBe(good)
  })

  test("an answer missing a VERB is a sentence naming which", async () => {
    oduOnPath(answering(handshake({
      tools: [tool("run_start", "checkout"), tool("run_retry", "runId"), tool("run_wait", "runId")],
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.name).toBe("odu")
    expect(found.missing?.why).toContain("`run_cancel`")
    expect(found.missing?.why).toContain("`venue_hold`")
    expect(found.missing?.why).toContain("needs an upgrade")
  })

  test("an odu from BEFORE juspay/odu#105 is a missing-verb sentence, not a handover", async () => {
    oduOnPath(answering(handshake(SURFACE_BEFORE_105)))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("`run_start`")
    expect(found.missing?.why).toContain("`venue_release`")
    expect(found.missing?.why).toContain("needs an upgrade")
  })

  test("a whole tool surface aimed by nothing is the OTHER sentence — the one with a different fix", async () => {
    oduOnPath(answering(handshake({
      tools: SURFACE.tools.map((one) => tool(String(one["name"]))),
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("checkout")
    expect(found.missing?.why).toContain("needs an upgrade")
  })

  test("one directory verb without `checkout` refuses the whole surface — the run it could not aim is not named", async () => {
    oduOnPath(answering(handshake({
      tools: [tool("run_start", "expectedSha"), ...SURFACE.tools.slice(1)],
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("`run_start`")
    expect(found.missing?.why).toContain("`checkout`")
  })

  test("a run verb aimed by `checkout` instead of `runId` is refused too — aim is per verb", async () => {
    oduOnPath(answering(handshake({
      tools: [...SURFACE.tools.filter((one) => one["name"] !== "run_wait"), tool("run_wait", "checkout")],
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("`run_wait`")
    expect(found.missing?.why).toContain("`runId`")
  })

  test("a newer odu shipping an extra unaimed tool is still handed over", async () => {
    oduOnPath(answering(handshake({
      tools: [...SURFACE.tools, tool("future_verb")],
    })))
    const found = await probe({ PATH: where })
    expect(found.missing).toBeNull()
    expect(found.server).not.toBeNull()
  })

  describe("the ways of failing, told apart", () => {
    test("one that exits is `closed`, never `timedOut`", async () => {
      oduOnPath(`process.exit(0)`)
      const found = await probe({ PATH: where })
      expect(found.server).toBeNull()
      expect(found.missing?.why).toContain("closed the connection without answering")
    })


  })

  test("a probe that is called off kills the `odu mcp` it started, without waiting out the deadline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "olai-odu-"))
    made.push(dir)
    const pidFile = join(dir, "pid")
    process.env["OLAI_ODU_PROBE_PID"] = pidFile
    oduOnPath(`
      require("node:fs").writeFileSync(process.env.OLAI_ODU_PROBE_PID, String(process.pid))
      setInterval(() => {}, 1000)
    `)
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const asking = yield* Effect.forkChild(Effect.scoped(probing({ PATH: where })))
      yield* Effect.promise(() => until(() => existsSync(pidFile)))
      yield* Fiber.interrupt(asking)
    })))
    const pid = Number(readFileSync(pidFile, "utf8"))
    expect(Number.isFinite(pid)).toBe(true)
    await until(() => !alive(pid))
    expect(alive(pid)).toBe(false)
  })
})

const until = async (fact: () => boolean): Promise<void> => {
  for (let waited = 0; waited < 1_500 && !fact(); waited += 10) {
    await new Promise((resume) => { setTimeout(resume, 10) })
  }
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
