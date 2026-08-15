/**
 * What a write is CALLED, derived from the write itself.
 *
 * Value in, value out — a set and a plan, both of which {@link ./plan.ts}
 * already produces without a disk. What each case is really asserting is that
 * the answer agrees with what the commit panel would say about the same two
 * readings, which is the whole reason this is one derivation rather than a
 * table keyed by op name: `set_done` with `undo` and `set_done` without it are
 * one tool and opposite events.
 */

import type { OutlineSet, Sort } from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { setOf, steady } from "./fixtures.testlib.ts"
import { plan } from "./plan.ts"
import type { Request } from "./request.ts"
import { sortOfWrite } from "./sorted.ts"

const KITCHEN = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
].join("\n")

const house = (): OutlineSet => setOf({ "house.olai": KITCHEN })

/** Plan the request against the set, and say what the write would be called —
 *  exactly as {@link ../ops.ts} assembles a reply, about the node the plan says
 *  it was about. */
const sorting = (set: OutlineSet, request: Request): Sort | undefined => {
  const planned = plan(set, steady(), request)
  if (Result.isFailure(planned)) {
    throw new Error(
      `expected \`${request.op}\` to plan, and it refused: ${planned.failure.message}`,
    )
  }
  return sortOfWrite(set, planned.success)
}

describe("what a write is called", () => {
  test("a mark going on and coming off are opposite events of one op", () => {
    expect(sorting(house(), { op: "done", id: "order" })).toBe("done")
    expect(sorting(house(), { op: "done", id: "demo", undo: true })).toBe("undone")
  })

  test("a capture is created, however many nodes it brought", () => {
    expect(
      sorting(house(), {
        op: "add",
        parent: "kitchen",
        title: "pick a worktop",
        children: [{ title: "measure it" }, { title: "price it" }],
      }),
    ).toBe("created")
  })

  test("a note, a title and a date each say what they are", () => {
    expect(sorting(house(), { op: "desc", id: "order", desc: "oak" })).toBe("noted")
    expect(sorting(house(), { op: "title", id: "order", title: "order oak" })).toBe(
      "renamed",
    )
    expect(sorting(house(), { op: "date", id: "order", date: "2026-08-20" })).toBe(
      "scheduled",
    )
  })

  test("a reorder is a move", () => {
    expect(sorting(house(), { op: "move", id: "order", before: "demo" })).toBe("moved")
  })

  test("archiving reads as one node archived, not a departure and an arrival", () => {
    // The node leaves `house.olai` for the archive, and both ends are in the
    // plan — which is what lets the comparison match it across the two files.
    expect(sorting(house(), { op: "archive", id: "order" })).toBe("archived")
  })

  test("clearing a date is the opposite event of setting one, on one op", () => {
    // The case the commit message cites as a reason not to tabulate by op
    // name: `set_date` is one tool and two events, told apart by what the
    // field became rather than by which tool was called.
    const scheduled = setOf({
      "house.olai": `{"id":"order","ord":"a0","title":"order","date":"2026-08-20"}`,
    })
    expect(sorting(scheduled, { op: "date", id: "order", date: null })).toBe("unscheduled")
  })

  test("a new outline is created, seeded or empty", () => {
    // The other cited case, and both halves of it. A SEEDED create makes
    // records, so the comparison answers; an EMPTY one makes a file and no
    // record at all, and *nothing changed* would be a lie about a write that
    // just brought an outline into being.
    expect(
      sorting(house(), {
        op: "create",
        file: "garden.olai",
        seed: { title: "Garden", children: [{ title: "prune the apple" }] },
      }),
    ).toBe("created")
    expect(sorting(house(), { op: "create", file: "garden.olai" })).toBe("created")
  })

  test("a write that changes no record says nothing rather than `edited`", () => {
    // Retyping a title as it already reads. The planner refuses most no-ops
    // outright (`set_done` on a node that is already done is a refusal, not a
    // write), so this is the shape that reaches here — and inventing a change
    // to report about it is the one thing this answer must not do.
    expect(sorting(house(), { op: "title", id: "order", title: "order the cabinets" }))
      .toBeUndefined()
  })
})
