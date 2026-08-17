/**
 * What a call that sent an agent out says for itself.
 *
 * No DOM: it is one function over one row, and the question it answers is the
 * one the panel had no answer to — an agent has been sent out and has reported
 * NOTHING, so there is no lane, no rail and no name anywhere, and every claim
 * below is about that stretch rather than about the tidy one after it.
 */

import type { ChatEntry } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { faceOf } from "./spawn.ts"

/** A tool row, as the transcript serves one. */
const row = (extra: Partial<ChatEntry> = {}): ChatEntry => ({
  id: "tool:agent-1",
  seq: 0,
  kind: "tool",
  text: "explore the outline",
  ...extra,
})

describe("which rows have a face at all", () => {
  test("a call that spawned nobody has none", () => {
    expect(faceOf(row({ status: "in_progress" }))).toBeNull()
    // ... including a call a subagent MADE, which is the other end of this
    // feature and not this one: it is drawn in a lane, and a face on it would
    // claim the subagent had spawned an agent of its own.
    expect(faceOf(row({ parent: "tool:agent-1", status: "in_progress" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    // The transient the list has: a key is in `rows()` and its value is a
    // frame behind. Asked about nothing, the answer is nothing.
    expect(faceOf(undefined)).toBeNull()
  })
})

describe("who was sent", () => {
  test("the kind of agent, in the agent's own word", () => {
    expect(faceOf(row({ spawned: { kind: "Explore" } }))?.who).toBe("Explore")
    // Not rounded to anything this panel has heard of — a name nobody here
    // knows is still the name somebody started.
    expect(faceOf(row({ spawned: { kind: "roadmap-auditor" } }))?.who)
      .toBe("roadmap-auditor")
  })

  test("a spawn that named no kind still says somebody was sent", () => {
    // `subagent_type` is optional on the tool that spawns one, so this is an
    // ordinary spawn rather than a broken one — and a row saying nothing where
    // every other spawn says something reads as a row that failed.
    expect(faceOf(row({ spawned: {} }))?.who).toBe("agent")
  })
})

describe("whether it is still going", () => {
  test("a spawn is announced pending, and that is what most of them wear", () => {
    // The status a spawn keeps until its first beat, which for a slow one is
    // the whole of the stretch this exists for — so it is the default rather
    // than a case to fall through.
    expect(faceOf(row({ spawned: { kind: "Explore" } }))?.doing).toBe("starting…")
    expect(faceOf(row({ spawned: { kind: "Explore" }, status: "pending" }))?.doing)
      .toBe("starting…")
  })

  test("a spawn the agent says is running says so", () => {
    expect(
      faceOf(row({ spawned: { kind: "Explore" }, status: "in_progress" }))?.doing,
    ).toBe("working…")
  })

  test("a spawn that has stopped has nothing live left to say", () => {
    // The half that has to come OFF: a rail still saying "working…" under a
    // finished call tells a reader a fan-out is running when the turn is over.
    expect(faceOf(row({ spawned: { kind: "Explore" }, status: "completed" }))?.doing)
      .toBeNull()
    expect(faceOf(row({ spawned: { kind: "Explore" }, status: "failed" }))?.doing)
      .toBeNull()
    // ... and who it was is still said, because the row is still the record of
    // an agent having been sent out.
    expect(faceOf(row({ spawned: { kind: "Explore" }, status: "completed" }))?.who)
      .toBe("Explore")
  })
})
