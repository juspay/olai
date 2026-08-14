import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { archivable, archiveQuestion, bulkEdits } from "./bulk.ts"

/** A row, as a bulk verb sees one: the record it IS (what a move names) and the
 *  node it SHOWS (what a mark names), which for a mirror are two ids. */
const row = (id: string, shows: string = id, kind: "node" | "mirror" = "node"): Row =>
  ({
    kind,
    key: `/${id}`,
    children: [],
    at: { file: "house.jsonl", node: { id } },
    shows: { file: "house.jsonl", node: { id: shows } },
  } as unknown as Row)

const rows = [row("a"), row("b"), row("c")]

test("indenting a run goes in drawn order, so the run keeps its shape", () => {
  // `b` goes under the row above it; `c`'s row above is then that same row, so
  // it follows `b` under it. The other way round, `c` would land under `b`.
  expect(bulkEdits("in", rows)).toEqual([
    { verb: "move", id: "a", how: "in" },
    { verb: "move", id: "b", how: "in" },
    { verb: "move", id: "c", how: "in" },
  ])
})

test("outdenting goes from the bottom, or the run comes out backwards", () => {
  // Each lands immediately after what used to be its parent. Done downwards,
  // `c` would land between the parent and `b`.
  expect(bulkEdits("out", rows)).toEqual([
    { verb: "move", id: "c", how: "out" },
    { verb: "move", id: "b", how: "out" },
    { verb: "move", id: "a", how: "out" },
  ])
})

test("moving up walks down the run, and moving down walks up it", () => {
  const moved = (verb: "up" | "down") =>
    bulkEdits(verb, rows).map((edit) => ("id" in edit ? edit.id : ""))
  expect(moved("up")).toEqual(["a", "b", "c"])
  expect(moved("down")).toEqual(["c", "b", "a"])
})

test("complete is the same toggle Ctrl+Enter sends, once per row, on the node it SHOWS", () => {
  expect(bulkEdits("complete", [row("mirror-of-herbs", "herbs", "mirror")])).toEqual([
    { verb: "toggle", id: "herbs", mark: "done" },
  ])
})

test("a placement is not something this face may put away", () => {
  const mixed = [row("a"), row("mirror-of-herbs", "herbs", "mirror")]
  // The verb itself leaves it out — the node it shows lives somewhere else,
  // and archiving from here would put away a subtree nobody is looking at.
  expect(bulkEdits("archive", mixed)).toEqual([{ verb: "archive", id: "a" }])
  // ...and the bar refuses the whole gesture rather than quietly doing three
  // of four rows.
  expect(archivable(mixed)).toBe(false)
  expect(archivable(rows)).toBe(true)
  expect(archivable([])).toBe(false)
})

test("the confirm names the rows the write moves, not the ones that were picked", () => {
  expect(archiveQuestion(2, 2)).toContain("these 2 rows")
  expect(archiveQuestion(2, 2)).not.toContain("under them")
  expect(archiveQuestion(2, 5)).toContain("the 3 rows under them")
  expect(archiveQuestion(1, 1)).toContain("this row")
  // One row taking three with it says "under IT", and one row taking one says
  // "the row" — a question a person is asked to agree to has to read as
  // English, and a count is where that most easily stops being true.
  expect(archiveQuestion(1, 4)).toContain("the 3 rows under it")
  expect(archiveQuestion(1, 2)).toContain("the row under it")
})
