/**
 * When a lane has to name itself.
 *
 * No DOM: it is one function over a row and the row above it, and the whole
 * question is whether a reader can already tell whose work they are looking at.
 * The case that matters is two agents running at once — the reason anybody
 * spawns them — because that is when the rails interleave and an unlabelled
 * one stops being an answer.
 */

import { describe, expect, test } from "bun:test"

import { laneOf } from "./lanes.ts"

/** The main agent's own work: no lane, whatever is above it. */
const MINE = undefined

describe("which rows are drawn in a lane", () => {
  test("a row nobody else made is in no lane at all", () => {
    expect(laneOf(MINE, "agent:1", MINE)).toBeNull()
    expect(laneOf(MINE, undefined, undefined)).toBeNull()
    // ... including one that follows a subagent's work: the lane ENDS when the
    // main agent picks the thread back up, and a row that inherited the rail
    // would attribute the main agent's next call to a subagent.
    expect(laneOf(MINE, "tool:call-1", "tool:agent-1")).toBeNull()
  })

  test("the first call under the frame that spawned it needs no label", () => {
    // The ordinary case, and the one worth NOT labelling: the `Agent` frame is
    // the row directly above, so a rail dropping out of it says everything a
    // name would.
    expect(laneOf("tool:agent-1", "tool:agent-1", MINE)).toEqual({
      parent: "tool:agent-1",
      labelled: false,
    })
  })

  test("one agent's second call carries on the lane it is already in", () => {
    expect(laneOf("tool:agent-1", "tool:call-1", "tool:agent-1")).toEqual({
      parent: "tool:agent-1",
      labelled: false,
    })
  })

  test("two agents at once each say who they are", () => {
    // THE CASE THE LABEL EXISTS FOR. Two subagents running together interleave
    // on one feed, so every row is the start of a run — and a rail with
    // nothing written on it would say "somebody else did this" and refuse to
    // say which of the two.
    expect(laneOf("tool:agent-2", "tool:call-1", "tool:agent-1")).toEqual({
      parent: "tool:agent-2",
      labelled: true,
    })
    expect(laneOf("tool:agent-1", "tool:call-2", "tool:agent-2")).toEqual({
      parent: "tool:agent-1",
      labelled: true,
    })
  })

  test("a lane resumed after the main agent spoke says who it is again", () => {
    // A subagent's report lands as the main agent's prose, and its next call
    // arrives under that paragraph. The run was broken, so the lane opens
    // again — which is what keeps a rail from ever pointing at nothing.
    expect(laneOf("tool:agent-1", "agent:4", MINE)).toEqual({
      parent: "tool:agent-1",
      labelled: true,
    })
  })

  test("the first row of the transcript can still open a lane", () => {
    // Nothing above it at all — a conversation reloaded straight into a
    // subagent's work.
    expect(laneOf("tool:agent-1", undefined, undefined)).toEqual({
      parent: "tool:agent-1",
      labelled: true,
    })
  })
})
