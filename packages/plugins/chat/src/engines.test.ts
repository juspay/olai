/**
 * AN ENGINE PLUGIN TURNED OFF WHILE THE PANEL IS RUNNING — the roster following
 * the fibers, and the conversation that was seated on it ending.
 *
 * ## The defect this is written from
 *
 * The engines table was always live: the `Agents` door's `register` is an
 * `acquireRelease` on the offering plugin's own scope, so switching the claude
 * row off at the plugins panel really did delete it. What was frozen was every
 * READING of it — `Chat.make` was handed two arrays, built once when the serve
 * came up, and never asked again. So the human, on a live serve:
 *
 *   - switched claude off and a conversation already open with claude KEPT
 *     WORKING;
 *   - opened the picker and was still offered claude, and picking it WORKED,
 *     because the id off the wire was resolved against the same frozen array.
 *
 * Both halves of that are the switch saying one thing and the product doing
 * another, which is the one failure a control like this may not have.
 *
 * ## Why these cases sit at the panel rather than at the plugin runtime
 *
 * What moved is a reading, and the reading is this package's. Whether a fiber
 * unloads when its row is switched off is `@olai/bundle`'s claim and is benched
 * there; what happens to the panel when the table it reads changes underneath it
 * is here, over a table this file simply replaces. No plugin runtime, no loader,
 * no subprocess for the cases that are about a list.
 *
 * The one case that IS about a subprocess uses the real fixture agent, because
 * the claim is that a live conversation ENDS — and an ending you can only see by
 * asking a double whether it was asked to stop is not the claim.
 */

import { collector } from "@olai/log/testlib"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect, References } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { makePanel } from "./chat.ts"
import type { ChatState } from "./wire/members.ts"

/** The agent a session-opening case talks to — the same fixture the lifecycle
 *  cases drive, because "the conversation ended" is only worth asserting about a
 *  conversation that had really started. */
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

/** WHO the panel says it is talking to, or `null` — narrowed, because `talking`
 *  is a union and the other arm is the panel ASKING which agent, which is a
 *  different fact and not one any case here is about. */
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

/**
 * A PANEL OVER A TABLE THIS TEST OWNS — which is the whole harness.
 *
 * `switched` replaces the list a plugin runtime would be holding; the panel is
 * then told the way the server half tells it.
 *
 * ## THE READING HANDS BACK A FRESH ARRAY, and that is load-bearing
 *
 * The first version of this closed over one array and let the cases `splice` it.
 * Every case passed — and so did a deliberately BROKEN panel that captured the
 * roster once at construction, because what it had captured was a reference to
 * the array the case then mutated underneath it. A harness that shares one
 * mutable object with the code under test cannot tell a live reading from a
 * frozen one; it was found by mutation and it is the reason this copies.
 *
 * It is also what the real thing does: the server half walks a `Map` and sorts
 * it, which is a new array every time it is asked.
 */
const panelOver = async (initial: ReadonlyArray<Installed>) => {
  let table: ReadonlyArray<Installed> = initial
  const states: Array<ChatState> = []
  const panel = await run(makePanel({
    roster: () => [...table],
    engines: () => table.map((row) => row.id),
    cwd,
    tools: () => null,
    onState: (state) => void states.push(state),
    onTranscript: () => {},
  }))
  return {
    panel,
    states,
    last: () => states[states.length - 1] ?? panel.state(),
    /** What the engines table now holds, and then the signal — the two things
     *  a plugin's release does, in that order. */
    switched: (to: ReadonlyArray<Installed>) => {
      table = to
      return run(panel.enginesMoved)
    },
  }
}

/**
 * THE PICKER FOLLOWS THE TABLE — the first half of what the human saw, and the
 * one a person meets before they have opened anything.
 *
 * `state().roster` is what the picker draws. Frozen, it went on offering an
 * engine whose plugin had been switched off; asked, it is the table.
 *
 * BOTH DIRECTIONS, because a switch has two: a row that leaves goes, and a row
 * that arrives — which is somebody turning a plugin ON, or a serve started
 * `--plugins=kolu` getting its engines back — appears. Only asserting the first
 * would pass against an implementation that emptied the list and never refilled.
 */
test("an engine switched off leaves the picker, and one switched on enters it", async () => {
  const { panel, last, switched } = await panelOver([CLAUDE, CODEX])

  expect(panel.state().roster.map((one) => one.id)).toEqual(["claude", "codex"])

  await switched([CODEX])
  expect(last().roster.map((one) => one.id)).toEqual(["codex"])

  await switched([CLAUDE, CODEX])
  expect(last().roster.map((one) => one.id)).toEqual(["claude", "codex"])
})

/**
 * ...AND AN ID OFF THE WIRE IS RESOLVED AGAINST THE SAME TABLE, which is the
 * half that made the first one more than cosmetic.
 *
 * A stale tab — or a person who opened the picker a moment before the row left —
 * sends an id the panel no longer has. Frozen, the lookup found the row and
 * STARTED IT: a subprocess for an engine whose plugin is gone, which is the
 * switch failing to mean anything at all. It is refused in words now, the same
 * way an id this machine never had is.
 *
 * THE EXACT SENTENCE, and that is not fussiness — it is what makes this case
 * about the LOOKUP. Asserting only that the call failed passes against a frozen
 * lookup too: the row is found, the agent is started, and the open fails a
 * moment later for an unrelated reason with a sentence that also happens to name
 * the engine. Measured, on the mutation. The sentence `withRow` gives is the one
 * thing only the live reading produces.
 */
test("a new conversation cannot be opened on an engine whose plugin has left", async () => {
  const { panel, switched } = await panelOver([CLAUDE, CODEX])

  await switched([CODEX])

  const refused = await run(Effect.result(panel.newSession("claude")))
  expect(refused._tag).toBe("Failure")
  if (refused._tag === "Failure") {
    expect(refused.failure.reason).toBe("there is no agent called `claude` on this machine")
  }
})

/**
 * THE LAST ENGINE LEAVING PUTS THE PANEL IN ITS `off` FACE, with the same word a
 * serve composed without an engine row shows.
 *
 * This is the invariant the whole loader surface rests on, seen from inside the
 * panel: a row somebody switched off and a row the flag never named are ONE
 * state. `no-engine` is the word for both, so a person who switches their last
 * engine off reads what a person who never had one reads.
 *
 * AND IT COMES BACK, which is the half that says this is a face rather than a
 * terminal state — the panel was never rebuilt and never restarted.
 */
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
})

/**
 * A CONVERSATION SEATED ON A DEPARTED ENGINE ENDS — the half the human hit
 * first, and the one that is a ruling rather than a stale read.
 *
 * The argument, so it is not re-litigated: the paper's boundary rule reverts
 * REGISTRATIONS and compensates EMISSIONS, and a spawned ACP child is a process
 * olai owns exclusively and can stop, so it is inside the boundary. And a row
 * switched off must be the same state as a row the flag never named — under
 * `--plugins=` without claude there is no claude conversation, so a moment after
 * switching claude off there must not be one either.
 *
 * ## What is asserted, and why it is these three
 *
 * The panel stops TALKING to it (`talking` is null), the face says the agent is
 * `gone` rather than merely idle, and the sentence NAMES the plugins panel —
 * because `gone` reaches a person three different ways and the other two are not
 * something they did. A person who was mid-conversation is owed the reason.
 *
 * THE REAL SUBPROCESS is what makes this worth running: the claim is that a live
 * conversation ends, and it is only live once the fixture has handshaken and
 * opened a session.
 */
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
  // ...AND THE OTHER ENGINE IS UNTOUCHED, which is what keeps this a fact about
  // the row that left rather than about any row moving: the picker still offers
  // codex, so the person can start again without a restart.
  expect(last().roster.map((one) => one.id)).toEqual(["codex"])
  await run(panel.stop)
})

/**
 * ...AND A CONVERSATION ON AN ENGINE THAT DID NOT MOVE IS LEFT ALONE.
 *
 * The signal is rung on EVERY register and every release of ANY engine — a
 * plugin runtime has no idea which panel cares — so the common case by far is a
 * table that moved in a way this conversation has no stake in. A verb that
 * stopped the bound agent whenever it was called would pass the case above and
 * be catastrophic in this one: switching kolu on would end somebody's chat.
 */
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
