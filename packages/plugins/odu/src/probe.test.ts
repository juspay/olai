/**
 * What counts as "odu's `mcp` is here", against real subprocesses.
 *
 * The probe is a handshake, so the fixtures are executables: an `odu` written
 * into a directory this test names as the PATH, answering (or refusing to)
 * the way a real one would. Nothing here talks to a coordinator — the
 * question the probe asks is whether the BINARY speaks the shape, and a
 * script can answer it. `olai-plugin-kolu`'s `./probe.test.ts` is the pattern,
 * verbatim: the environment is a PARAMETER, so every case hands over the
 * environment it is a claim about, and a machine really running odu decides
 * none of them.
 *
 * WHAT IS PINNED: absence is a MISSING ROW, never quiet (a packaged olai
 * bakes the binary onto the server's PATH, so a resolve that finds nothing
 * names the command and says so, with no `where` — nothing was resolved);
 * an answer carrying the six verbs WITH `checkout` on every one is
 * the server a session gets (path pinned, args are `mcp`, env empty); a
 * missing VERB and a missing `checkout` are TWO sentences, because they are
 * two different fixes; a wedged server and a hung-up one are told apart by
 * which verdict comes back (`timedOut` against a fixture that reads and never
 * answers, `closed` against one that exits); and a paginated `tools/list`
 * arrives whole, because the loop that asks for the next page is the sort of
 * code that rots unexercised.
 */

import { spawn, type ChildProcess } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Fiber } from "effect"

import { askOver, ODU_COMMAND, type Probed, probing, type Verdict } from "./probe.ts"

/** ONE WHOLE PROBE, over its own scope — which is what the child belongs to
 *  now, so a probe that answers has already killed the `odu mcp` it asked.
 *  The cases below read like the promise-shaped `probe` they were written
 *  against; what changed is who owns the subprocess. */
const probe = (env: Record<string, string | undefined>): Promise<Probed> =>
  Effect.runPromise(Effect.scoped(probing(env)))

/** Every directory this test made, removed after each case. */
const made: Array<string> = []

/** ...and every child this test spawned ITSELF — the two cases that ask
 *  `askOver` directly start a wedged fixture with no probe around it, so
 *  nothing else is going to kill them. They used to be one orphaned `odu`
 *  apiece, per run of this file. */
const started: Array<ChildProcess> = []
const wedged = (): ChildProcess => {
  const child = spawn(join(where, ODU_COMMAND), ["mcp"], { stdio: ["pipe", "pipe", "ignore"] })
  started.push(child)
  return child
}

/** WHERE THIS CASE'S `odu` IS — the PATH the probe is handed, never this
 *  process's own. */
let where = ""

afterEach(() => {
  for (const child of started.splice(0)) child.kill()
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
  where = ""
})

/** An `odu` on the probed PATH, running the given script under the
 *  interpreter this test itself runs under — so the fixture needs nothing on
 *  PATH, which is the one thing this test is rearranging. */
const oduOnPath = (body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-odu-"))
  made.push(dir)
  where = dir
  const bin = join(dir, ODU_COMMAND)
  writeFileSync(bin, `#!${process.execPath}\n${body}`)
  chmodSync(bin, 0o755)
  return bin
}

/** The fixtures' own half of the protocol: read lines, and for each `id`
 *  seen write the answer for that id back. A fixture's ANSWERS are the case's
 *  claim, so the body takes them verbatim. `initialized` carries no id, and
 *  is what lets this helper emit one to prove the probe hears past it. */
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

/** One tool as odu's `tools/list` would carry it, with or without the shape
 *  this olai was written against. */
const tool = (name: string, checkout = true): Record<string, unknown> => ({
  name,
  inputSchema: { type: "object", properties: checkout ? { checkout: { type: "string" } } : {} },
})

/** The whole answer a build of the right shape gives on the second request. */
const SURFACE = {
  tools: [
    tool("run"),
    tool("node_rerun"),
    tool("node_cancel"),
    tool("wait_for_settle"),
    tool("lease"),
    tool("release"),
    // ...and the ones the shape ALSO carries, which the probe asks nothing of:
    tool("lane_cancel"),
    tool("cancel"),
    tool("runs"),
  ],
}

/** One full handshake's worth of answers, from which each case varies one
 *  fact. */
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
    // The distinctive half, pinned rather than shape-checked: the promise
    // the bake makes, in the sentence itself — it is the part a drift in
    // the ruling would quietly take away.
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
    // `accessSync` walks past it the way execvp walks past an EACCES: the
    // later entry is the one that answers, and the failure mode a plain
    // `existsSync` would find is pinned as unreachable.
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
      tools: [tool("run"), tool("node_rerun"), tool("wait_for_settle")],
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.name).toBe("odu")
    expect(found.missing?.why).toContain("`node_cancel`")
    expect(found.missing?.why).toContain("`lease`")
    expect(found.missing?.why).toContain("needs an upgrade")
  })

  test("a whole tool surface taking no `checkout` is the OTHER sentence — the one with a different fix", async () => {
    // The dangerous half: this odu genuinely RUNS runs, and a conversation
    // spanning lanes would aim every one of them at olai's served root.
    oduOnPath(answering(handshake({
      tools: SURFACE.tools.map((one) => tool(String(one["name"]), false)),
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("checkout")
    expect(found.missing?.why).toContain("needs an upgrade")
  })

  test("one tool without `checkout` refuses the whole surface — the run it could not aim is not named", async () => {
    oduOnPath(answering(handshake({
      tools: [tool("run", false), tool("node_rerun"), tool("node_cancel"), tool("wait_for_settle"), tool("lease"), tool("release")],
    })))
    const found = await probe({ PATH: where })
    expect(found.server).toBeNull()
    expect(found.missing?.why).toContain("`run`")
  })

  test("a newer odu shipping an extra tool without `checkout` is still handed over", async () => {
    // Presence and aim are checked against the verbs a conversation is
    // promised, and nothing wider: a newer odu growing a tool this olai
    // does not aim is not a reason to refuse the six that do.
    oduOnPath(answering(handshake({
      tools: [...SURFACE.tools, tool("future_verb", false)],
    })))
    const found = await probe({ PATH: where })
    expect(found.missing).toBeNull()
    expect(found.server).not.toBeNull()
  })

  test("`tools/list` that PAGES arrives whole — the loop, not the shape", async () => {
    oduOnPath(`
      const lines = require("node:readline").createInterface({ input: process.stdin })
      let page = 0
      lines.on("line", (line) => {
        if (line.trim() === "") return
        let message
        try { message = JSON.parse(line) } catch { return }
        if (message.id === undefined) return
        if (message.id === 1) {
          process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }) + "\\n")
          return
        }
        page += 1
        const answers = ${JSON.stringify(SURFACE.tools)}
        const half = Math.ceil(answers.length / 2)
        const slice = page === 1 ? answers.slice(0, half) : answers.slice(half)
        const next = page === 1 ? { nextCursor: "two" } : {}
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: slice, ...next } }) + "\\n")
      })
    `)
    const found = await probe({ PATH: where })
    expect(found.missing).toBeNull()
    expect(found.server).not.toBeNull()
  })

  describe("the ways of failing, told apart", () => {
    test("a wedged `odu mcp` is `timedOut`, never `closed`", async () => {
      // The fixture reads forever and says nothing: the deadline is the only
      // thing that answers, and which answer it is carries the whole case.
      oduOnPath(`setInterval(() => {}, 1000)`)
      const verdict = await askOver(wedged(), 100)
      expect(verdict).toEqual({ _tag: "timedOut", deadlineMs: 100 })
    })

    test("one that exits is `closed`, never `timedOut`", async () => {
      oduOnPath(`process.exit(0)`)
      const found = await probe({ PATH: where })
      expect(found.server).toBeNull()
      expect(found.missing?.why).toContain("closed the connection without answering")
    })

    test("one that says something that is not JSON-RPC is `failed`, with the sentence", async () => {
      oduOnPath(`process.stdout.write("the bridge is up\\n"); setInterval(() => {}, 1000)`)
      const verdict: Verdict = await askOver(wedged(), 1000)
      expect(verdict._tag).toBe("failed")
      if (verdict._tag === "failed") expect(verdict.cause).toContain("not JSON-RPC")
    })
  })

  test("a probe that is called off kills the `odu mcp` it started, without waiting out the deadline", async () => {
    // THE CHILD IS THE ASKING'S, and this is what that buys. A conversation
    // whose open is abandoned — the session goes away, the plugin stops —
    // used to leave a wedged `odu mcp` running until the five-second deadline
    // let the old `probe` reach its kill. Interrupting the ask closes its
    // scope, and the scope is what holds the child.
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
      // IT RETURNS, which is half the claim: an ask parked in an
      // uninterruptible wait would stand here for the whole deadline and this
      // case would die on the runner's own timeout rather than on an
      // expectation.
      yield* Fiber.interrupt(asking)
    })))
    const pid = Number(readFileSync(pidFile, "utf8"))
    expect(Number.isFinite(pid)).toBe(true)
    await until(() => !alive(pid))
    expect(alive(pid)).toBe(false)
  })
})

/** Poll a fact into being, or give up — a budget well under the probe's own
 *  five-second deadline, so a child that is only killed by the deadline fails
 *  this rather than passing it slowly. */
const until = async (fact: () => boolean): Promise<void> => {
  for (let waited = 0; waited < 1_500 && !fact(); waited += 10) {
    await new Promise((resume) => { setTimeout(resume, 10) })
  }
}

/** Is that process still there? `signal 0` is the ask that sends nothing. */
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
