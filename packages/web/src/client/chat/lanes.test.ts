/**
 * When a lane has to name itself.
 *
 * No DOM: it is one function over a row and the row above it, and the whole
 * question is whether a reader can already tell whose work they are looking at.
 * The case that matters is two agents running at once — the reason anybody
 * spawns them — because that is when the rails interleave and an unlabelled
 * one stops being an answer.
 *
 * ... AND THE PRIOR QUESTION, which arrived later and is the last block here:
 * whether the column draws the row at all. `filedUnder` is that rule, and the
 * two are answered by the same file because a row that leaves the column has no
 * lane to label and a row that stays has to keep one.
 */

import type { ChatEntry } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { filedUnder, laneOf } from "./lanes.ts"

/** A row, as the transcript serves one. Only three fields are read here and
 *  all three are named: its own key, the agent it belongs to, and what KIND of
 *  row it is — a question names its lane where a tool call would not. */
const row = (id: string, parent?: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: id,
  status: "pending",
  ...(parent === undefined ? {} : { parent }),
})

/** ... and the same row as a QUESTION the agent stopped to ask. */
const asked = (id: string, parent?: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "ask",
  text: id,
  ask: { fields: [], outcome: null },
  ...(parent === undefined ? {} : { parent }),
})

/** ... and a row that is neither, which cannot be filed under anybody: the
 *  agent's own prose has no `parent` field to carry. */
const said = (id: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "agent",
  text: id,
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

  test("a call drawn under the very frame that spawned it is not drawn here at all", () => {
    // RE-POINTED, and the note is the point. This used to claim that such a row
    // needs no label — the `Agent` frame is the row directly above, so a rail
    // dropping out of it says everything a name would. The column can no longer
    // hold that row: `filedUnder` files a call whose `Agent` frame the panel HAS
    // into that agent's own shelf, and `laneOf` is asked of the column and of
    // nothing else (`./Transcript.tsx`). So the old scenario is a shape
    // production cannot produce, and what is left of it is the filing.
    const call = row("tool:call-1", "tool:agent-1")
    expect(filedUnder(call)).toBe("tool:agent-1")
    // The rule it used to reach is still live for the rows that STAY — a run
    // whose `Agent` frame never arrived, where the second call is established
    // by the first and the lookup misses.
    expect(laneOf(call, row("tool:call-0", "tool:agent-1"), () => undefined))
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

  test("a subagent's question names its lane even where a call would not", () => {
    // THE ONE EXCEPTION, and it is about what the row IS rather than where it
    // sits. A form blocks the turn and the panel points people AT it — from
    // the composer, the header and the app's agent toggle — so a reader
    // arrives at it without having read the row above, and a permission form
    // answered in the wrong agent's name is a decision made on a false
    // premise. Both established shapes, because a form lands in either:
    // directly under the call that spawned the agent...
    expect(laneOf(asked("ask:1", "tool:agent-1"), row("tool:agent-1"), nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
    // ... and in the middle of that agent's own run.
    expect(
      laneOf(asked("ask:1", "tool:agent-1"), row("tool:call-1", "tool:agent-1"), nameOf),
    ).toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("the main agent's own question is in no lane, named or otherwise", () => {
    // Most questions. The exception above is about which lane a form names,
    // never about putting one in a lane it does not belong to.
    expect(laneOf(asked("ask:1"), row("tool:call-1", "tool:agent-1"), nameOf))
      .toBeNull()
  })

  test("a question does not make the lane under it open again", () => {
    // The other half of the same fix, and the one that was VISIBLE: an
    // unattributed form between two of one subagent's calls broke the run, so
    // the lane re-introduced itself underneath it and the panel read as two
    // agents where there was one. The form is in the lane now, so the call
    // after it is still established and stays silent.
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-1"),
        asked("ask:1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: null })
  })

  test("a question from an agent the panel never saw start still says somebody", () => {
    expect(laneOf(asked("ask:1", "tool:gone"), row("tool:gone"), nameOf))
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

describe("which rows leave the column entirely", () => {
  test("a call a subagent made answers with the agent that made it", () => {
    // Five agents out is five agents' greps interleaved in one column, in one
    // voice, under a main agent whose own words are pushed off the screen —
    // the panel telling you about work you did not ask to watch instead of the
    // work you did. The key is the `Agent` frame's own, so the shelf hangs off
    // the row a reader scrolling back actually arrives at.
    expect(filedUnder(row("tool:call-1", "tool:agent-1"))).toBe("tool:agent-1")
  })

  test("the main agent's own call stays in the column", () => {
    // Nearly every row in nearly every conversation, and the case a mistake
    // here would empty the transcript over.
    expect(filedUnder(row("tool:call-1"))).toBeNull()
  })

  test("a subagent's QUESTION stays in the column whoever asked it", () => {
    // A FORM BEHIND A CLICK IS A TURN THAT HANGS FOREVER. An `ask` blocks the
    // turn — nothing else in the conversation happens until somebody presses
    // something — and the panel points people at one from outside the list
    // entirely. Filed into a shelf that has to be opened, the one row that has
    // to be findable would be the one row nobody can find. It keeps the rail
    // and the name instead, which is what `laneOf` above is now mostly for.
    expect(filedUnder(asked("ask:1", "tool:agent-1"))).toBeNull()
  })

  test("a row that is neither a call nor a question is the column's", () => {
    expect(filedUnder(said("agent:1"))).toBeNull()
  })

  test("a row that has not arrived yet is filed nowhere", () => {
    // The transient the list has: a key is in `rows()` and its value is a frame
    // behind. A row asked about nothing that answered a parent would drop a key
    // out of the column and into a shelf that has no such row.
    expect(filedUnder(undefined)).toBeNull()
  })
})
