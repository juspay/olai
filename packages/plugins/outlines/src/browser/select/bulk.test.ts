import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { archivable, bulkEdits } from "./bulk.ts"
const row = (id: string, shows: string = id, kind: "node" | "mirror" = "node"): Row =>
  ({
    kind,
    key: `/${id}`,
    children: [],
    at: { file: "house.olai", node: { id } },
    shows: { file: "house.olai", node: { id: shows } },
  } as unknown as Row)

const rows = [row("a"), row("b"), row("c")]

test("indenting a run goes in drawn order, so the run keeps its shape", () => {
  expect(bulkEdits("in", rows)).toEqual([
    { verb: "move", id: "a", how: "in" },
    { verb: "move", id: "b", how: "in" },
    { verb: "move", id: "c", how: "in" },
  ])
})

test("outdenting goes from the bottom, or the run comes out backwards", () => {
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
  expect(bulkEdits("trash", mixed)).toEqual([{ verb: "trash", id: "a" }])
  expect(archivable(mixed)).toBe(false)
  expect(archivable(rows)).toBe(true)
  expect(archivable([])).toBe(false)
})

