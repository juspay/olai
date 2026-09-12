import { describe, expect, test } from "bun:test"

import { writeIn as wroteIn, fileOf } from "./reply.ts"

/** A tool result as the MCP call answers with one. */
const result = (structured: unknown) => structured

const MARKED = {
  did: "outlines_done",
  id: "order",
  title: "order the cabinets",
  file: "house.olai",
  summary: "done: order the cabinets",
  sort: "done",
  rev: 4,
  why: "the write is waiting to be committed",
}

describe("what an olai write says for itself", () => {
  test("the reply's own classification is what the row will draw", () => {
    expect(wroteIn(result(MARKED))).toEqual({
      sort: "done",
      id: "order",
      title: "order the cabinets",
      file: "house.olai",
      nudge: null,
    })
  })

  test("the node's ID rides along, which is what makes the row a reference", () => {
    // Missing or mistyped IDs fail the write contract; an empty ID is plain text.
    const { id: _id, ...anonymous } = MARKED
    expect(wroteIn(result(anonymous))).toBeUndefined()
    expect(wroteIn(result({ ...MARKED, id: 7 }))).toBeUndefined()
  })

  test("a nudge rides along, because advice on a write that landed is news", () => {
    expect(wroteIn(result({ ...MARKED, nudge: "everything under `kitchen` is done" })))
      .toMatchObject({ nudge: "everything under `kitchen` is done" })
  })

  test("structured content handed straight through is read the same way", () => {
    // An adapter that forwards the structured half as the raw output rather
    // than the whole result. One `??` to tolerate, against a silent blank.
    expect(wroteIn(MARKED)).toMatchObject({ sort: "done", title: "order the cabinets" })
  })

  test("a write that changed no record has no word for it", () => {
    const { sort: _sort, ...unchanged } = MARKED
    expect(wroteIn(result(unchanged))?.sort).toBeNull()
  })

  test("a classification this codebase does not have is not passed on", () => {
    // Checked against the format's own list rather than cast: a word the panel
    // has no phrase for would ride the wire and draw a blank where the story
    // goes.
    expect(wroteIn(result({ ...MARKED, sort: "vandalised" }))).toBeUndefined()
  })

  test("anything that is not one of our replies draws nothing", () => {
    // Somebody else's MCP server, a refusal (which carries no `did` and is
    // drawn as a refusal row of its own), and the two empties.
    expect(wroteIn(result({ terminals: ["one", "two"] }))).toBeUndefined()
    expect(wroteIn(result({ kind: "not-found", message: "no such node" }))).toBeUndefined()
    expect(wroteIn(null)).toBeUndefined()
    expect(wroteIn("done")).toBeUndefined()
  })
})

test("files are top-level reply facts, including reads and projected roots", () => {
  expect(fileOf({ file: "Finance.olai" })).toBe("Finance.olai")
  for (const reply of [null, {}, { file: "" }, { file: 7 }, { nodes: [] }]) expect(fileOf(reply)).toBeNull()
  expect(wroteIn({ file: "Finance.olai", title: "read" })).toBeUndefined()
  expect(wroteIn({ ...MARKED, id: "" })?.id).toBeNull()
})
