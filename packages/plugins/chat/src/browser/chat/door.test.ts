/**
 * What the door under a spawn says, or that there is no door.
 *
 * A subagent's calls are not in the transcript any more ({@link ./lanes.ts}'s
 * `filedUnder`), so this control is the LASTING way back to them — the live
 * strip above the scroll goes quiet the moment the agent reports back, and a
 * record you could read only while the agent was still running would be a
 * fan-out you could look at exactly when you were too busy to. Two things are
 * pinned here and both are about a reader deciding whether to open something:
 * that a door is drawn only where there is something behind it, and that what
 * it says is the honest size of it.
 *
 * No DOM: one function over a row and a number.
 */

import { describe, expect, test } from "bun:test"

import { doorOf } from "./door.ts"
import { toolRow as row } from "./rows.testlib.ts"

describe("which rows have a door at all", () => {
  test("a row that sent nobody has none, whatever the count says", () => {
    expect(doorOf(row({ status: "completed" }), 0)).toBeNull()
    // The count is a fact about the LIST and the row is the fact about the
    // agent, so the row is asked FIRST: a list that miscounted must not be able
    // to hang a shelf off the main agent's own `Read`.
    expect(doorOf(row({ status: "completed" }), 4)).toBeNull()
    // ... including a call a subagent MADE, which is the other end of this
    // feature: that row is already IN somebody's shelf, and a door on it would
    // claim it had one of its own.
    expect(doorOf(row({ parent: "tool:agent-1", status: "in_progress" }), 3)).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    // The transient the list has: a key is in `rows()` and its value is a frame
    // behind. Asked about nothing, the answer is nothing.
    expect(doorOf(undefined, 3)).toBeNull()
  })
})

describe("what the door says", () => {
  test("an agent that has called nothing yet is a rail, not a door", () => {
    // The whole of the stretch a fan-out is actually watched through, and the
    // thing that says so is already there and already right — the live rail
    // under the row (`./spawn.ts`). A door beside it reading *no calls yet*
    // would be a control that opens on an empty shelf, drawn at the one moment
    // somebody is looking hardest.
    expect(doorOf(row({ spawned: { kind: "Explore" }, status: "pending" }), 0)).toBeNull()
    expect(doorOf(row({ spawned: { kind: "Explore" }, status: "in_progress" }), 0))
      .toBeNull()
    // ... and an agent that FINISHED having called nothing has its whole answer
    // in the row's own fold, so there is still nothing to open.
    expect(doorOf(row({ spawned: { kind: "Explore" }, status: "completed" }), 0))
      .toBeNull()
  })

  test("one call is `1 call`, and never `1 calls`", () => {
    // The count is the only honest thing this control can say about what is
    // behind it, so it is the one string here a reader reads as a fact — and a
    // plural on a single call is the panel getting a fact wrong in the smallest
    // possible way.
    expect(doorOf(row({ spawned: { kind: "Explore" }, status: "completed" }), 1))
      .toBe("1 call")
  })

  test("more than one counts them", () => {
    expect(doorOf(row({ spawned: {} }), 7)).toBe("7 calls")
    // Still counting while the agent is out: the door opens beside the live
    // rail rather than after it.
    expect(doorOf(row({ spawned: { kind: "Explore" }, status: "in_progress" }), 2))
      .toBe("2 calls")
  })
})

describe("which agent the door opens onto", () => {
  test("a fan-out's doors say what each agent was sent to do", () => {
    // MEASURED ON A REAL FAN-OUT, not imagined: four agents dispatched in one
    // message reach the panel as four rows whose title is the TOOL's name, so
    // a door saying only how many calls are behind it would be four identical
    // buttons — and which you press decides what you read.
    expect(
      doorOf(row({ text: "Task", spawned: { said: "count the markdown files" } }), 3),
    ).toBe("count the markdown files · 3 calls")
  })

  test("... and say nothing extra when the row already says it", () => {
    // A door reading *explore the outline · 3 calls* under a row reading
    // *explore the outline* is furniture, and furniture in a 26rem drawer is
    // the line that pushes the conversation off the screen.
    expect(
      doorOf(row({ text: "explore the outline", spawned: { said: "explore the outline" } }), 3),
    ).toBe("3 calls")
    // ... including the case where the spawn described itself not at all, where
    // falling back to the title is what makes the two equal.
    expect(doorOf(row({ text: "Task", spawned: {} }), 3)).toBe("3 calls")
  })
})
