import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { flatten, neighbour } from "./order.ts"

/** A row, as far as this walk is concerned: the place it sits in, the node it
 *  shows, and its children. Built by hand rather than derived from a fixture
 *  set — what is under test is the walk over a shape, and `@olai/format` has
 *  its own suite for producing one.
 *
 *  Both identities are here because the walk uses both, and the difference is
 *  the point: a fold is asked of the NODE (`../fold/rows.ts`), and where the
 *  caret is standing is a PLACE. */
const row = (id: string, key: string, children: ReadonlyArray<Row> = []): Row =>
  ({
    kind: "node",
    key,
    children,
    at: { file: "house.jsonl", node: { id } },
    shows: { file: "house.jsonl", node: { id } },
  } as unknown as Row)

//   a
//   ├ a1
//   │ └ a1x
//   └ a2
//   b
const tree: ReadonlyArray<Row> = [
  row("a", "/a", [row("a1", "/a/a1", [row("a1x", "/a/a1/a1x")]), row("a2", "/a/a2")]),
  row("b", "/b"),
]

const keys = (rows: ReadonlyArray<Row>): ReadonlyArray<string> => rows.map((r) => r.key)

test("the drawn order is the order they are painted in", () => {
  expect(keys(flatten(tree, new Set()))).toEqual([
    "/a",
    "/a/a1",
    "/a/a1/a1x",
    "/a/a2",
    "/b",
  ])
})

test("a folded branch's children are not on screen, so they are not in it", () => {
  expect(keys(flatten(tree, new Set(["a1"])))).toEqual([
    "/a",
    "/a/a1",
    "/a/a2",
    "/b",
  ])
})

test("the fold set is read by NODE, not by the place the row sits in", () => {
  // The place key of `a1` names its ancestors; folding under that spelling is
  // what the reading used to do, and it is not what it holds any more.
  expect(keys(flatten(tree, new Set(["/a/a1"])))).toEqual([
    "/a",
    "/a/a1",
    "/a/a1/a1x",
    "/a/a2",
    "/b",
  ])
})

test("the arrows step through what is drawn, across levels", () => {
  // The one thing worth getting wrong: `↓` from the last child of a branch
  // lands on the next row wherever it is in the shape.
  expect(neighbour(tree, new Set(), "/a/a1/a1x", 1)?.key).toBe("/a/a2")
  expect(neighbour(tree, new Set(), "/a/a2", 1)?.key).toBe("/b")
  expect(neighbour(tree, new Set(), "/b", -1)?.key).toBe("/a/a2")
})

test("`↓` over a folded branch skips what it is hiding", () => {
  expect(neighbour(tree, new Set(["a1"]), "/a/a1", 1)?.key).toBe("/a/a2")
})

test("either end of the page is where the caret stays", () => {
  // No wrap-around: a page that jumped to the top when you pressed `↓` once
  // too often would be a surprise rather than a convenience.
  expect(neighbour(tree, new Set(), "/a", -1)).toBeUndefined()
  expect(neighbour(tree, new Set(), "/b", 1)).toBeUndefined()
})

test("a place that is not drawn has no neighbours", () => {
  expect(neighbour(tree, new Set(), "/gone", 1)).toBeUndefined()
})
