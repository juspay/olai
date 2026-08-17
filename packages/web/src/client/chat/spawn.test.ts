/**
 * What a call that sent an agent out says for itself.
 *
 * No DOM: two functions over one row, and the question they answer is the one
 * the panel had no answer to — an agent has been sent out and has reported
 * NOTHING, so there is no lane, no rail and no name anywhere, and most of what
 * is claimed below is about that stretch rather than about the tidy one after
 * it. The exception is the last block, which is about the stretch after the
 * WRONG end: an agent that died in the middle of one.
 */

import type { ChatEntry } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { doingOf, whoOf } from "./spawn.ts"

/** A tool row, as the transcript serves one. */
const row = (extra: Partial<ChatEntry> = {}): ChatEntry => ({
  id: "tool:agent-1",
  seq: 0,
  kind: "tool",
  text: "explore the outline",
  ...extra,
})

/** A conversation with a turn in flight, which is the only state in which
 *  anything is running to draw. */
const TURNING = true

describe("which rows sent somebody", () => {
  test("a call that spawned nobody has no face at all", () => {
    expect(whoOf(row({ status: "in_progress" }))).toBeNull()
    expect(doingOf(row({ status: "in_progress" }), TURNING)).toBeNull()
    // ... including a call a subagent MADE, which is the other end of this
    // feature and not this one: it is drawn in a lane, and a face on it would
    // claim the subagent had spawned an agent of its own.
    expect(whoOf(row({ parent: "tool:agent-1", status: "in_progress" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    // The transient the list has: a key is in `rows()` and its value is a
    // frame behind. Asked about nothing, the answer is nothing.
    expect(whoOf(undefined)).toBeNull()
    expect(doingOf(undefined, TURNING)).toBeNull()
  })
})

describe("who was sent", () => {
  test("the kind of agent, in the agent's own word", () => {
    expect(whoOf(row({ spawned: { kind: "Explore" } }))).toBe("Explore")
    // Not rounded to anything this panel has heard of — a name nobody here
    // knows is still the name somebody started.
    expect(whoOf(row({ spawned: { kind: "roadmap-auditor" } }))).toBe("roadmap-auditor")
  })

  test("a spawn that named no kind still says somebody was sent", () => {
    // Naming a kind is optional in the tool that starts an agent, so this is
    // an ordinary spawn rather than a broken one — and a row saying nothing
    // where every other spawn says something reads as a row that failed.
    expect(whoOf(row({ spawned: {} }))).toBe("agent")
  })

  test("... and goes on saying it after the agent has reported back", () => {
    // The row is the record of an agent having been sent out, which does not
    // stop being true when it comes back.
    expect(whoOf(row({ spawned: { kind: "Explore" }, status: "completed" })))
      .toBe("Explore")
  })
})

describe("whether it is still going", () => {
  test("a spawn is announced pending, and that is what most of them wear", () => {
    // The status a spawn keeps until its first beat, which for a slow one is
    // the whole of the stretch this exists for — so it is the default rather
    // than a case to fall through.
    expect(doingOf(row({ spawned: { kind: "Explore" } }), TURNING)).toBe("starting…")
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "pending" }), TURNING))
      .toBe("starting…")
  })

  test("a spawn the agent says is running says so", () => {
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "in_progress" }), TURNING))
      .toBe("working…")
  })

  test("a spawn that has stopped has nothing live left to say", () => {
    // The half that has to come OFF: a rail still saying "working…" under a
    // finished call tells a reader a fan-out is running when the turn is over.
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "completed" }), TURNING))
      .toBeNull()
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "failed" }), TURNING))
      .toBeNull()
  })

  test("nor has one whose CONVERSATION has stopped, whatever its own row says", () => {
    // The way this actually goes wrong, and the half a row cannot answer. A
    // status is sticky, and the rows a dead agent left are deliberately still
    // on screen to read — so an agent that died between announcing a spawn and
    // reporting on it leaves a row that says `pending` for as long as the panel
    // is open. Asked of the row alone, that is a rail pulsing "starting…" under
    // a process that no longer exists.
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "pending" }), false))
      .toBeNull()
    expect(doingOf(row({ spawned: { kind: "Explore" }, status: "in_progress" }), false))
      .toBeNull()
    // ... and who it was is still said, because that is a fact about what
    // happened rather than about what is happening.
    expect(whoOf(row({ spawned: { kind: "Explore" }, status: "pending" })))
      .toBe("Explore")
  })
})
