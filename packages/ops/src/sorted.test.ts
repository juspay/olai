import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { NO_KINDS, type OutlineSet, type Sort, type WriteRequest as Request } from "@olai/format"
import { describe, expect, test } from "bun:test"
import { Result } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping } from "./plan.ts"
import { sortOfWrite } from "./sorted.ts"

const KITCHEN = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"demolition","done":"2026-08-01"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets"}`,
].join("\n")

const house = (): OutlineSet => setOf({ "house.olai": KITCHEN })

const sorting = (set: OutlineSet, request: Request): Sort | undefined => {
  const at = readingOf(set)
  const planned = plan(scoping(at, steady(), NO_KINDS, "outline-olai"), request)
  if (Result.isFailure(planned)) {
    throw new Error(
      `expected \`${request.op}\` to plan, and it refused: ${planned.failure.message}`,
    )
  }
  return sortOfWrite(at.set, at.derived, planned.success)
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
    expect(sorting(house(), { op: "trash", id: "order" })).toBe("trashed")
  })

  test("clearing a date is the opposite event of setting one, on one op", () => {
    const scheduled = setOf({
      "house.olai": `{"id":"order","ord":"a0","title":"order","date":"2026-08-20"}`,
    })
    expect(sorting(scheduled, { op: "date", id: "order", date: null })).toBe("unscheduled")
  })

  test("a new outline is created, seeded or empty", () => {
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
    expect(sorting(house(), { op: "title", id: "order", title: "order the cabinets" }))
      .toBeUndefined()
  })
})
