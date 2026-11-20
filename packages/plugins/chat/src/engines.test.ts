import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed, Standing } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel } from "./chat.ts"
import { volatile } from "./memory.ts"
import type { ChatState } from "./wire/members.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "doorbell-agent.ts")

const installed = (id: string): Installed => ({
  id,
  name: id,
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
})

const CLAUDE = installed("claude")
const CODEX = installed("codex")

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(collector().layer),
    ),
  )

const talkingId = (state: ChatState): string | null =>
  state.talking?.kind === "agent" ? state.talking.id : null

const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-engines-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

const panelOver = async (initial: ReadonlyArray<Installed>) => {
  let table: ReadonlyArray<Installed> = initial
  const states: Array<ChatState> = []
  const panel = await run(makePanel({
    roster: () => table.map(seated),
    cwd,
    tools: () => null,
    memory: volatile(),
    onState: (state) => void states.push(state),
    onTranscript: () => {},
  }))
  return {
    panel,
    states,
    last: () => states[states.length - 1] ?? panel.state(),
    switched: (to: ReadonlyArray<Installed>) => {
      table = to
      return run(panel.enginesMoved)
    },
  }
}

test("an engine switched off leaves the picker, and one switched on enters it", async () => {
  const { panel, last, switched } = await panelOver([CLAUDE, CODEX])

  expect(panel.state().roster.map((one) => one.id)).toEqual(["claude", "codex"])

  await switched([CODEX])
  expect(last().roster.map((one) => one.id)).toEqual(["codex"])

  await switched([CLAUDE, CODEX])
  expect(last().roster.map((one) => one.id)).toEqual(["claude", "codex"])
})

test("a new conversation cannot be opened on an engine whose plugin has left", async () => {
  const { panel, switched } = await panelOver([CLAUDE, CODEX])

  await switched([CODEX])

  const refused = await run(Effect.result(panel.newSession("claude")))
  expect(refused._tag).toBe("Failure")
  if (refused._tag === "Failure") {
    expect(refused.failure.reason).toBe("there is no agent called `claude` on this machine")
  }
})

test("the last engine leaving is the off face, and a returning one leaves it", async () => {
  const { last, switched } = await panelOver([CLAUDE])

  await switched([])
  expect(last().status).toBe("off")
  expect(last().off).toEqual({ kind: "no-engine" })
  expect(last().roster).toEqual([])

  await switched([CODEX])
  expect(last().status).not.toBe("off")
  expect(last().off).toBeNull()
  expect(last().roster.map((one) => one.id)).toEqual(["codex"])
  expect(last().talking).toEqual({ kind: "asking" })
})

test("losing the last available engine retains missing rows and recovers on installation", async () => {
  const missing: Standing = {
    id: "other", name: "Other", standing: "not-here",
    missing: { name: "Other", why: "install the executable", where: null },
  }
  let table: ReadonlyArray<Standing> = [seated(CLAUDE), missing]
  const panel = await run(makePanel({
    roster: () => table,
    cwd, tools: () => null, memory: volatile(), onState: () => {}, onTranscript: () => {},
  }))
  try {
    table = [missing]
    await run(panel.enginesMoved)
    expect(panel.state().status).toBe("off")
    expect(panel.state().off).toEqual({ kind: "none-installed" })
    expect(panel.state().roster).toEqual([missing])

    table = [seated(installed("other"))]
    await run(panel.enginesMoved)
    expect(panel.state().status).toBe("idle")
    expect(panel.state().off).toBeNull()
    expect(panel.state().roster).toEqual([{ id: "other", name: "other", standing: "here" }])
  } finally {
    await run(panel.stop)
  }
})

test("switching off the engine a conversation is on ends it, and says why", async () => {
  const { panel, last, switched } = await panelOver([CLAUDE, CODEX])
  await run(panel.start)
  await run(panel.newSession("claude"))
  await until("the conversation to open", () => panel.state().session !== null)
  expect(talkingId(panel.state())).toBe("claude")

  await switched([CODEX])

  expect(last().talking).toBeNull()
  expect(last().status).toBe("gone")
  expect(last().trouble).toContain("plugins panel")
  expect(last().roster.map((one) => one.id)).toEqual(["codex"])
  await run(panel.stop)
})

test("another engine leaving does not touch the conversation in progress", async () => {
  const { panel, last, switched } = await panelOver([CLAUDE, CODEX])
  await run(panel.start)
  await run(panel.newSession("claude"))
  await until("the conversation to open", () => panel.state().session !== null)
  const session = panel.state().session?.id

  await switched([CLAUDE])

  expect(talkingId(last())).toBe("claude")
  expect(last().status).not.toBe("gone")
  expect(last().session?.id).toBe(session)
  expect(last().roster.map((one) => one.id)).toEqual(["claude"])
  await run(panel.stop)
})
