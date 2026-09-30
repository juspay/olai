import { expect, test } from "bun:test"
import { Effect, Fiber } from "effect"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { airForkAt } from "@olai/acp/engine"
import { make } from "./agent.ts"
import { SAYS_NOTHING } from "./agents/legs.testlib.ts"
import type { AgentEvent } from "./events.ts"

const run = Effect.runPromise
for (const point of [null, "answer-1"]) {
  for (const refusal of [null, "open", ...(point === null ? [] : ["load"]), "mode"]) {
    test(`rewind ${point ?? "first"}: ${refusal ?? "success"} preserves ownership until preparation succeeds`, async () => {
      const cwd = mkdtempSync(join(tmpdir(), "olai-rewind-"))
      const events: AgentEvent[] = []
      const remembered: string[] = []
      const agent = await run(make({ id: "fixture", leg: { ...SAYS_NOTHING, forkAt: airForkAt, nativeActivity: true,
        bypassMode: "full", bypassModeRequired: true }, command: process.execPath,
        args: [join(import.meta.dirname, "fixtures/rewind-agent.ts")], cwd, tools: () => null,
        memory: { recall: Effect.succeed(null), remember: value => Effect.sync(() => { remembered.push(value.session) }) },
        onEvent: event => events.push(event),
      }))
      try {
        await run(agent.boot)
        events.length = 0
        if (refusal !== null) writeFileSync(join(cwd, `refuse-${refusal}`), "")
        const result = await run(Effect.result(agent.rewind(point)))
        expect(result._tag).toBe(refusal === null ? "Success" : "Failure")
        if (refusal !== null) {
          expect(events).toEqual([])
          expect(remembered).toEqual(["session-1"])
          expect((await run(agent.sessions)).length).toBe(1)
        } else {
          expect(remembered).toEqual(["session-1", "session-2"])
          expect(events.filter(event => event._tag === "said").map(event => event.text))
            .toEqual(point === null ? [] : ["preceding answer"])
          expect(events.filter(event => event._tag === "tool").map(event => event.title))
            .toEqual(point === null ? [] : ["Explorer", "read history", undefined])
        }
        await run(agent.prompt("still usable"))
        const requests = readFileSync(join(cwd, "requests.log"), "utf8").trim().split("\n").map(line => JSON.parse(line))
        expect(requests.findLast(request => request.method === "session/prompt").params.sessionId)
          .toBe(refusal === null ? "session-2" : "session-1")
        if (point !== null) expect(requests.find(request => request.method === "session/fork").params._meta).toEqual(airForkAt(point))
        if (refusal === "load" || refusal === "mode") {
          rmSync(join(cwd, `refuse-${refusal}`))
          events.length = 0
          await run(agent.newSession)
          expect(events.some(event => event._tag === "said" && event.text === "late failed replay")).toBe(false)
        }
      } finally { await run(agent.stop); rmSync(cwd, { recursive: true, force: true }) }
    })
  }
}

for (const unsupported of ["leg", "handshake"]) {
  test(`rewind needs both opt-ins: missing ${unsupported}`, async () => {
    const cwd = mkdtempSync(join(tmpdir(), "olai-no-rewind-"))
    const events: AgentEvent[] = []
    const agent = await run(make({ id: "fixture",
      leg: { ...SAYS_NOTHING, ...(unsupported === "leg" ? {} : { forkAt: airForkAt }) },
      command: process.execPath,
      args: [join(import.meta.dirname, "fixtures/rewind-agent.ts"), ...(unsupported === "handshake" ? ["--no-fork"] : [])],
      cwd, tools: () => null, memory: { recall: Effect.succeed(null), remember: () => Effect.void },
      onEvent: event => events.push(event),
    }))
    try {
      await run(agent.boot)
      expect(events.find(event => event._tag === "advertised")).toMatchObject({ rewinds: false })
      expect((await run(Effect.result(agent.rewind(null))))._tag).toBe("Failure")
      expect(readFileSync(join(cwd, "requests.log"), "utf8")).not.toContain('"session/fork"')
    } finally { await run(agent.stop); rmSync(cwd, { recursive: true, force: true }) }
  })
}

for (const canDelete of [true, false]) {
  test(`interrupted rewind withdraws preparation with ${canDelete ? "delete" : "close"}`, async () => {
    const cwd = mkdtempSync(join(tmpdir(), "olai-rewind-interrupt-"))
    const agent = await run(make({ id: "fixture", leg: { ...SAYS_NOTHING, forkAt: airForkAt },
      command: process.execPath,
      args: [join(import.meta.dirname, "fixtures/rewind-agent.ts"), ...(canDelete ? [] : ["--no-delete"])],
      cwd, tools: () => null, memory: { recall: Effect.succeed(null), remember: () => Effect.void }, onEvent: () => {},
    }))
    try {
      await run(agent.boot)
      writeFileSync(join(cwd, "hold-load"), "")
      const fiber = Effect.runFork(agent.rewind("answer-1"))
      const deadline = Date.now() + 2000
      while (!readFileSync(join(cwd, "requests.log"), "utf8").includes('"session/load"') && Date.now() < deadline) {
        await run(Effect.sleep("10 millis"))
      }
      expect(readFileSync(join(cwd, "requests.log"), "utf8")).toContain('"session/load"')
      await run(Fiber.interrupt(fiber))
      const requests = readFileSync(join(cwd, "requests.log"), "utf8").trim().split("\n").map(line => JSON.parse(line))
      expect(requests.findLast(request => request.method === `session/${canDelete ? "delete" : "close"}`)?.params.sessionId).toBe("session-2")
      expect((await run(agent.sessions)).length).toBe(canDelete ? 1 : 2)
      await run(agent.prompt("original still works"))
      expect(readFileSync(join(cwd, "requests.log"), "utf8")).toContain('"sessionId":"session-1","prompt"')
    } finally { await run(agent.stop); rmSync(cwd, { recursive: true, force: true }) }
  })
}
