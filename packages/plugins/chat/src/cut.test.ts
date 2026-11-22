/**
 * A TURN A STOP CUTS SHORT, AND THE PANEL THAT SAYS SO.
 *
 * Chat's activation ends whenever its row restarts — a chat setting changed,
 * chat switched off and on, olai restarting — and the agent goes with it, an
 * answer in flight included. The panel that reopens the conversation is a new
 * one. These cases hold the record between the two ({@link ./cut.ts}) and the
 * two ends of the panel that use it: a stop with a turn running writes it, and
 * the next open of that conversation says the answer was stopped, once.
 *
 * The panel cases use the real fixture agent, because what is claimed is about
 * a turn that was really running and a conversation that was really reopened.
 */

import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "@kolu/acp-client/testlib"
import type { Installed } from "./agents/roster.ts"
import { seated } from "./agents/roster.testlib.ts"
import { makePanel } from "./chat.ts"
import { forLocalState } from "./cut.ts"
import { ephemeralLocalState, type ChatLocalState } from "./local.ts"
import { RECORDED } from "./live.ts"
import { volatile } from "./memory.ts"
import type { Memory } from "@kolu/acp-client"

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(collector().layer),
    ),
  )

test("a cut turn is kept once, newest first and capped, and forgetting it is for good", async () => {
  const local = ephemeralLocalState()
  const record = forLocalState(local)
  const one = { agent: "claude", session: "sess-1" }
  await run(record.note(one))
  await run(record.note(one))
  for (let i = 2; i <= RECORDED + 1; i++) await run(record.note({ agent: "claude", session: `sess-${i}` }))
  // THE NEXT ACTIVATION reads what this one left, which is the whole point.
  const next = forLocalState(local)
  expect(next.cutShort(one)).toBe(false)
  expect(next.cutShort({ agent: "claude", session: `sess-${RECORDED + 1}` })).toBe(true)
  expect(next.cutShort({ agent: "codex", session: `sess-${RECORDED + 1}` })).toBe(false)
  await run(next.forget({ agent: "claude", session: `sess-${RECORDED + 1}` }))
  expect(forLocalState(local).cutShort({ agent: "claude", session: `sess-${RECORDED + 1}` })).toBe(false)
  expect(forLocalState(local).cutShort({ agent: "claude", session: `sess-${RECORDED}` })).toBe(true)
})

const FIXTURE = join(import.meta.dirname, "fixtures", "doorbell-agent.ts")
const ENGINE: Installed = {
  id: "engine",
  name: "Engine",
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-cut-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

/** One activation's panel over the directory's local document and memory. */
const panelOver = (local: ChatLocalState, memory: Memory) =>
  run(makePanel({
    roster: () => [seated(ENGINE)],
    cwd,
    tools: () => null,
    memory,
    cut: forLocalState(local),
    onState: () => {},
    onTranscript: () => {},
  }))

const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

const notices = (panel: Awaited<ReturnType<typeof panelOver>>): ReadonlyArray<string> =>
  [...panel.entries().values()].flatMap((row) => row.kind === "notice" ? [row.text] : [])

test("a stop with an answer in flight is said by the panel that reopens the conversation, once", async () => {
  const local = ephemeralLocalState()
  const memory = volatile()
  const first = await panelOver(local, memory)
  await run(first.start)
  // A SECOND CONVERSATION, so the one cut short is not the one a fresh
  // process opens by itself (`sess-1`): the notice must follow the session.
  await run(first.newSession("engine"))
  await until("the conversation to open", () => first.state().session?.id === "sess-2")
  const session = "sess-2"
  void Effect.runPromise(Effect.ignore(first.send("wait:20000", [], [])))
  await until("the turn to run", () => first.state().status === "thinking")
  await run(first.stop)
  expect(forLocalState(local).cutShort({ agent: "engine", session })).toBe(true)

  // THE NEXT ACTIVATION: a new panel over the same records. Its boot opens a
  // conversation of its own, which says nothing; reopening the cut one does.
  const second = await panelOver(local, memory)
  await run(second.start)
  await until("the boot's conversation", () => second.state().session !== null)
  expect(notices(second)).toEqual([])
  await run(second.loadSession("engine", session))
  await until("the conversation to reopen", () => second.state().session?.id === session)
  await until("the notice", () => notices(second).length > 0)
  expect(notices(second)).toEqual([
    "Chat restarted while Engine was answering, so that answer stopped where it was. "
      + "Send your message again to have it answered.",
  ])
  expect(forLocalState(local).cutShort({ agent: "engine", session })).toBe(false)
  await run(second.stop)

  // ...ONCE: the activation after that reopens it in silence.
  const third = await panelOver(local, memory)
  await run(third.start)
  await run(third.loadSession("engine", session))
  await until("the conversation to reopen again", () => third.state().session?.id === session)
  expect(notices(third)).toEqual([])
  await run(third.stop)
}, { timeout: 30_000 })

test("a stop with nothing running records nothing", async () => {
  const local = ephemeralLocalState()
  const panel = await panelOver(local, volatile())
  await run(panel.start)
  await run(panel.newSession("engine"))
  await until("the conversation to open", () => panel.state().session !== null)
  const session = panel.state().session!.id
  await run(panel.stop)
  expect(forLocalState(local).cutShort({ agent: "engine", session })).toBe(false)
})
