/**
 * When a lane has to name itself.
 *
 * No DOM: it is one function over a row and the row above it, and the whole
 * question is whether a reader can already tell whose work they are looking at.
 * The case that matters is two agents running at once — the reason anybody
 * spawns them — because that is when the rails interleave and an unlabelled
 * one stops being an answer.
 */

import type { ChatEntry } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { laneOf } from "./lanes.ts"

/** A row, as the transcript serves one. Only two fields are read here and both
 *  are named: its own key, and the agent it belongs to. */
const row = (id: string, parent?: string): ChatEntry => ({
  id,
  seq: 0,
  kind: "tool",
  text: id,
  ...(parent === undefined ? {} : { parent }),
})

/** Nothing above it at all — the top of the transcript. */
const NOTHING = undefined

/** The transcript's lookup, as a lane asks it. Every `Agent` frame the
 *  scenarios below use is titled after its own key, so a label naming one is
 *  proof the lookup was reached for rather than a string invented here. */
const nameOf = (key: string): string | undefined =>
  key.startsWith("tool:agent-") ? `sent to ${key}` : undefined

describe("which rows are drawn in a lane", () => {
  test("a row nobody else made is in no lane at all", () => {
    expect(laneOf(row("agent:2"), row("agent:1"), nameOf)).toBeNull()
    expect(laneOf(row("agent:1"), NOTHING, nameOf)).toBeNull()
    // ... including one that follows a subagent's work: the lane ENDS when the
    // main agent picks the thread back up, and a row that inherited the rail
    // would attribute the main agent's next call to a subagent.
    expect(laneOf(row("tool:call-2"), row("tool:call-1", "tool:agent-1"), nameOf)).toBeNull()
  })

  test("a row that has not arrived yet is in no lane either", () => {
    // The transient the list itself has: a key is in `rows()` and its value is
    // a frame behind. Asked about nothing, the answer is nothing.
    expect(laneOf(undefined, row("tool:agent-1"), nameOf)).toBeNull()
  })

  test("the first call under the frame that spawned it needs no label", () => {
    // The ordinary case, and the one worth NOT labelling: the `Agent` frame is
    // the row directly above, so a rail dropping out of it says everything a
    // name would.
    expect(laneOf(row("tool:call-1", "tool:agent-1"), row("tool:agent-1"), nameOf))
      .toEqual({ parent: "tool:agent-1", label: null })
  })

  test("one agent's second call carries on the lane it is already in", () => {
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-1"),
        row("tool:call-1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: null })
  })

  test("two agents at once each say who they are", () => {
    // THE CASE THE LABEL EXISTS FOR. Two subagents running together interleave
    // on one feed, so every row is the start of a run — and a rail with
    // nothing written on it would say "somebody else did this" and refuse to
    // say which of the two. The lane answers with the WORDS, so what a reader
    // would see is what this asserts.
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-2"),
        row("tool:call-1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-2", label: "sent to tool:agent-2" })
    expect(
      laneOf(
        row("tool:call-3", "tool:agent-1"),
        row("tool:call-2", "tool:agent-2"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("a lane resumed after the main agent spoke says who it is again", () => {
    // A subagent's report lands as the main agent's prose, and its next call
    // arrives under that paragraph. The run was broken, so the lane opens
    // again — which is what keeps a rail from ever pointing at nothing.
    expect(laneOf(row("tool:call-4", "tool:agent-1"), row("agent:4"), nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("the first row of the transcript can still open a lane", () => {
    // A conversation reloaded straight into a subagent's work.
    expect(laneOf(row("tool:call-1", "tool:agent-1"), NOTHING, nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("a frame the panel never got is still somebody, and still a lane", () => {
    // The lookup misses — a replay that dropped the `Agent` row, a frame still
    // in flight. "A subagent did this" is the half of the sentence worth
    // saying even when the other half is missing, and it is the LANE that says
    // so rather than every row that draws one.
    expect(laneOf(row("tool:call-1", "tool:gone"), NOTHING, nameOf))
      .toEqual({ parent: "tool:gone", label: "a subagent" })
  })

  test("a row whose own key is another agent's does not answer for it", () => {
    // The shape the old signature let a caller spell: the key of one row and
    // the parent of another. `above.id` and `above.parent` now come off ONE
    // value, so the only lane that can be established is the one the row above
    // is actually in.
    expect(laneOf(row("tool:agent-1", "tool:agent-2"), row("tool:agent-1"), nameOf))
      .toEqual({ parent: "tool:agent-2", label: "sent to tool:agent-2" })
  })
})
