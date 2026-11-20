import { expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { namedExactly } from "@kolu/acp/engine"
import { makePanel } from "./chat.ts"
import { volatile } from "./memory.ts"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"

import { fixtureAgent, SAYS_NOTHING } from "@kolu/acp-client/testlib"

const run = Effect.runPromise
for (const stored of [false, true]) {
  for (const required of [false, true]) {
    test(`${stored ? "loaded" : "new"} panel after ${required ? "required" : "optional"} mode refusal`, async () => {
      const cwd = mkdtempSync(join(tmpdir(), "olai-mode-panel-"))
      writeFileSync(join(cwd, "reject-mode"), "")
      const row: Installed = {
        id: "test-agent", name: "Test agent", prompt: { kind: "first-turn" },
        adapter: { command: process.execPath, args: [fixtureAgent("mode-agent.ts"),
          "--history", ...(stored ? ["--stored"] : [])] },
        leg: { ...SAYS_NOTHING, bypassMode: "full", bypassModeRequired: required,
          models: { config: "model", nameIn: namedExactly } },
      }
      const panel = await run(makePanel({
        roster: () => [seated(row)], cwd, tools: () => null, memory: volatile(),
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
          expect(state.settings.find((option) => option.id === "mode")?.value).toBe("default")
          if (stored) expect(transcript).toContain("restored history")
        }
      } finally {
        await run(panel.stop)
        rmSync(cwd, { recursive: true, force: true })
      }
    })
  }
}
