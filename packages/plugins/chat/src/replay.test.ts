/**
 * A REPLAY REACHES A READER ONCE, WHEN IT HAS ARRIVED.
 *
 * `session/load` re-sends a whole conversation before it answers. Published
 * as it came, every tab drew that history a few rows a frame and followed it
 * down the screen — seconds, for a long chat. `./chat.ts` holds the replayed
 * rows and hands them over in one change at `replayEnded`; this drives a real
 * agent over a fixture that replays across several ticks, and reads what a
 * subscriber was told.
 */

import { afterEach, beforeEach, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { QUEUES } from "./agents/legs.testlib.ts"
import type { Installed } from "./agents/roster.ts"
import { makePanel, type Panel } from "./chat.ts"
import type { Change } from "./transcript.ts"

const FIXTURE = join(import.meta.dirname, "fixtures", "replay-agent.ts")

const ROW: Installed = {
  id: "replaying",
  name: "replaying",
  adapter: { command: process.execPath, args: [FIXTURE] },
  leg: QUEUES,
  prompt: { kind: "first-turn" },
}

let cwd = ""
const wasState = process.env["XDG_STATE_HOME"]

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "olai-replay-"))
  process.env["XDG_STATE_HOME"] = cwd
})

afterEach(() => {
  if (wasState === undefined) delete process.env["XDG_STATE_HOME"]
  else process.env["XDG_STATE_HOME"] = wasState
  rmSync(cwd, { recursive: true, force: true })
})

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect)

const until = async (what: string, ready: () => boolean, ms = 8_000): Promise<void> => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (ready()) return
    await run(Effect.sleep("20 millis"))
  }
  throw new Error(`waited ${ms}ms for ${what} and it never happened`)
}

const texts = (change: Change): ReadonlyArray<string> => change.upserts.map(([, entry]) => entry.text)

test("a loaded conversation is published as one change, after the one that clears the last", async () => {
  const told: Array<Change> = []
  const chat: Panel = await run(makePanel({
    roster: () => [ROW],
    engines: () => [],
    cwd,
    tools: () => null,
    scoping: null,
    onState: () => {},
    onTranscript: (change) => told.push(change),
  }))
  try {
    await run(chat.start)
    await until("the fresh conversation to open", () => chat.state().session?.id === "fresh")
    await run(chat.send("the conversation being left", [], []))
    await until("its turn to end", () => chat.state().status === "idle" && chat.entries().size > 0)
    const left = [...chat.entries().keys()]

    const from = told.length
    await run(chat.loadSession("replaying", "stored"))
    await until("the stored conversation to open", () => chat.state().session?.id === "stored")
    const during = told.slice(from)

    // The conversation being left goes at once, and says nothing else.
    expect(during[0]?.removes.toSorted()).toEqual(left.toSorted())
    expect(during[0]?.upserts).toEqual([])
    // ... and the history arrives in ONE change: every row it ended with,
    // whole, with no pieces of it on the wire before.
    const rows = during.slice(1).filter((change) => change.upserts.length > 0)
    expect(rows).toHaveLength(1)
    expect(during.slice(1).flatMap((change) => change.appends)).toEqual([])
    expect(rows[0]?.upserts.map(([key]) => key).toSorted()).toEqual([...chat.entries().keys()].toSorted())
    expect(texts(rows[0]!)).toContain("what did we decide?")
    expect(texts(rows[0]!)).toContain("we decided to order the cabinets.")
  } finally {
    await run(chat.stop)
    await run(Effect.sleep("40 millis"))
  }
}, 15_000)
