import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { namedExactly } from "@olai/acp/engine"
import { makePanel } from "./chat.ts"
import type { Installed } from "./agents/roster.ts"

import { make, type Agent } from "./agent.ts"
import { SAYS_NOTHING } from "./agents/legs.testlib.ts"
import type { AgentEvent } from "./events.ts"
import type { MemorySnapshot } from "./memory.ts"

const run = Effect.runPromise
const withAgent = async (
  mode: string | null, stored: boolean,
  body: (it: { agent: Agent; events: AgentEvent[]; remembered: MemorySnapshot[];
    cwd: string; requests: () => Array<{ method: string; params?: { sessionId?: string; modeId?: string } }> }) => Promise<void>,
  required = true,
) => {
  const cwd = mkdtempSync(join(tmpdir(), "olai-mode-"))
  const events: AgentEvent[] = []
  const remembered: MemorySnapshot[] = []
  const agent = await run(make({
    id: "test-agent", leg: { ...SAYS_NOTHING, bypassMode: mode, bypassModeRequired: required },
    command: process.execPath,
    args: [join(import.meta.dirname, "fixtures/mode-agent.ts"), ...(stored ? ["--stored"] : [])],
    cwd, tools: () => ({ name: "olai", url: "http://127.0.0.1:7714/mcp", token: "test" }),
    memory: { recall: Effect.succeed(null), remember: (value) => Effect.sync(() => { remembered.push(value) }) },
    onEvent: (event) => events.push(event),
  }))
  try {
    await body({ agent, events, remembered, cwd,
      requests: () => readFileSync(join(cwd, "requests.log"), "utf8").trim().split("\n").map((line) => JSON.parse(line)),
    })
  } finally {
    await run(agent.stop)
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe("session permission selection", () => {
  for (const stored of [false, true]) {
    for (const required of [false, true]) {
      for (const mode of ["full", "human", "auto", null]) {
        test(`${stored ? "restored" : "new"} boot and explicit opens preserve ${mode ?? "default"} (${required ? "required" : "optional"})`, async () => {
          await withAgent(mode, stored, async ({ agent, events, requests }) => {
            for (const open of [agent.boot, agent.newSession, agent.loadSession("stored")]) {
              await run(open)
              const settings = events.findLast((event) => event._tag === "settings")
              expect(settings?._tag === "settings" ? settings.settings.find((option) => option.id === "mode")?.currentValue : undefined)
                .toBe(mode ?? "default")
              await run(agent.prompt("report the preset"))
            }
            expect(events.filter((event) => event._tag === "said").map((event) => event.text))
              .toEqual([mode ?? "default", mode ?? "default", mode ?? "default"])
            const calls = requests().filter((call) => ["session/new", "session/load", "session/set_mode", "session/prompt"].includes(call.method))
            expect(calls.map((call) => call.method)).toEqual([
              stored ? "session/load" : "session/new", ...(mode ? ["session/set_mode"] : []), "session/prompt",
              "session/new", ...(mode ? ["session/set_mode"] : []), "session/prompt",
              "session/load", ...(mode ? ["session/set_mode"] : []), "session/prompt",
            ])
            for (let i = 0; i < calls.length; i++) {
              if (mode === null || calls[i]?.method !== "session/set_mode") continue
              expect(calls[i]?.params).toEqual({ modeId: mode, sessionId: calls[i + 1]?.params?.sessionId })
            }
          }, required)
        })
      }
    }
    test(`rejected ${stored ? "restored" : "new"} boot cannot admit a later prompt; retry can recover`, async () => {
      await withAgent("full", stored, async ({ agent, events, remembered, cwd, requests }) => {
        writeFileSync(join(cwd, "reject-mode"), "")
        for (const action of [agent.boot, agent.prompt("must not run")]) {
          const result = await run(Effect.result(action))
          expect(result._tag).toBe("Failure")
          if (result._tag === "Failure") expect(result.failure.why).toContain("could not select permission mode full")
        }
        expect(events.some((event) => event._tag === "trouble" && event.message.includes("mode selection refused"))).toBe(true)
        expect(events.some((event) => event._tag === "session")).toBe(false)
        expect(remembered).toEqual([])
        await run(agent.sessions) // Fixture sends a late chunk before the list response.
        expect(events.some((event) => event._tag === "said" && event.text === "late refused history")).toBe(false)
        expect(requests().some((call) => call.method === "session/prompt")).toBe(false)
        rmSync(join(cwd, "reject-mode"))
        await run(agent.prompt("retry"))
        expect(events.some((event) => event._tag === "said" && event.text === "full")).toBe(true)
      })
    })
  }
  for (const stored of [false, true]) {
    test(`optional mode refusal keeps ${stored ? "loaded" : "new"} boot and subsequent opens usable`, async () => {
      await withAgent("full", stored, async ({ agent, events, remembered, cwd, requests }) => {
        writeFileSync(join(cwd, "reject-mode"), "")
        for (const open of [agent.boot, agent.newSession, agent.loadSession("stored")]) {
          events.length = 0
          const count = remembered.length
          await run(open)
          expect(events.some((event) => event._tag === "session")).toBe(true)
          expect(remembered).toHaveLength(count + 1)
          expect(events.some((event) => event._tag === "trouble" && event.message.includes("mode selection refused"))).toBe(true)
          const settings = events.findLast((event) => event._tag === "settings")
          expect(settings?._tag === "settings" ? settings.settings.find((option) => option.id === "mode")?.currentValue : undefined)
            .toBe("default")
          await run(agent.prompt("use the existing permissions"))
          expect(events.some((event) => event._tag === "said" && event.text === "default")).toBe(true)
        }
        expect(requests().filter((call) => call.method === "session/set_mode")).toHaveLength(3)
        expect(requests().filter((call) => call.method === "session/prompt")).toHaveLength(3)
        rmSync(join(cwd, "reject-mode"))
        await run(agent.loadSession("stored"))
        await run(agent.prompt("selection now succeeds"))
        expect(events.some((event) => event._tag === "said" && event.text === "full")).toBe(true)
      }, false)
    })
  }
  for (const opening of ["new", "load"] as const) {
    test(`rejected explicit ${opening} does not retain the previous active session`, async () => {
      await withAgent("full", false, async ({ agent, cwd, events, remembered, requests }) => {
        await run(agent.boot)
        const count = remembered.length
        events.length = 0
        writeFileSync(join(cwd, "reject-mode"), "")
        const result = await run(Effect.result(opening === "new" ? agent.newSession : agent.loadSession("stored")))
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") expect(result.failure.why).toContain("mode selection refused")
        expect(events.some((event) => event._tag === "session")).toBe(false)
        expect(remembered).toHaveLength(count)
        expect((await run(Effect.result(agent.prompt("must not run"))))._tag).toBe("Failure")
        expect(requests().some((call) => call.method === "session/prompt")).toBe(false)
      })
    })
  }
})

// A real panel consumes the agent's events: checking only a rejection cannot
// prove that replayed history and the model header were withdrawn.
for (const stored of [false, true]) {
  for (const required of [false, true]) {
    test(`${stored ? "loaded" : "new"} panel after ${required ? "required" : "optional"} mode refusal`, async () => {
      const cwd = mkdtempSync(join(tmpdir(), "olai-mode-panel-"))
      writeFileSync(join(cwd, "reject-mode"), "")
      const row: Installed = {
        id: "test-agent", name: "Test agent", prompt: { kind: "first-turn" },
        adapter: { command: process.execPath, args: [join(import.meta.dirname, "fixtures/mode-agent.ts"),
          "--history", ...(stored ? ["--stored"] : [])] },
        leg: { ...SAYS_NOTHING, bypassMode: "full", bypassModeRequired: required,
          models: { config: "model", nameIn: namedExactly } },
      }
      const panel = await run(makePanel({
        roster: () => [row], engines: () => [], cwd, tools: () => null,
        onState: () => {}, onTranscript: () => {},
      }))
      try {
        await run(panel.start)
        const deadline = Date.now() + 5000
        while (panel.state().status === "booting" && Date.now() < deadline) await run(Effect.sleep("10 millis"))
        const state = panel.state()
        expect(state.status).not.toBe("booting")
        const transcript = JSON.stringify([...panel.entries().values()])
        expect(transcript).toContain("mode selection refused")
        if (required) {
          expect(state.session).toBeNull()
          expect(state.model).toBeNull()
          expect(state.settings).toEqual([])
          expect(state.servers).toEqual([])
          expect(transcript).not.toContain("restored history")
        } else {
          expect(state.session).not.toBeNull()
          expect(state.model).toBe("Test model")
          expect(state.settings.find((option) => option.id === "mode")?.currentValue).toBe("default")
          if (stored) expect(transcript).toContain("restored history")
        }
      } finally {
        await run(panel.stop)
        rmSync(cwd, { recursive: true, force: true })
      }
    })
  }
}
