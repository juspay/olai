import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { emptyPending } from "./draft.ts"
import { flatten, neighbour, reanchored, wired } from "./order.ts"
import type { Wire } from "./order.ts"

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
    at: { file: "house.olai", node: { id } },
    shows: { file: "house.olai", node: { id } },
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
  expect(neighbour(flatten(tree, new Set()), "/a/a1/a1x", 1)?.key).toBe("/a/a2")
  expect(neighbour(flatten(tree, new Set()), "/a/a2", 1)?.key).toBe("/b")
  expect(neighbour(flatten(tree, new Set()), "/b", -1)?.key).toBe("/a/a2")
})

test("`↓` over a folded branch skips what it is hiding", () => {
  expect(neighbour(flatten(tree, new Set(["a1"])), "/a/a1", 1)?.key).toBe("/a/a2")
})

test("either end of the page is where the caret stays", () => {
  // No wrap-around: a page that jumped to the top when you pressed `↓` once
  // too often would be a surprise rather than a convenience.
  expect(neighbour(flatten(tree, new Set()), "/a", -1)).toBeUndefined()
  expect(neighbour(flatten(tree, new Set()), "/b", 1)).toBeUndefined()
})

test("a place that is not drawn has no neighbours", () => {
  expect(neighbour(flatten(tree, new Set()), "/gone", 1)).toBeUndefined()
})

// ── the wire: blanks woven in with the rows ───────────────────────────

const spelled = (list: ReadonlyArray<Wire>): ReadonlyArray<string> =>
  list.map((one) => one.kind === "row" ? one.row.key : `(${one.pending.slot})`)

test("a draft stands exactly where its ghost is drawn", () => {
  expect(
    spelled(wired(tree, new Set(), [
      emptyPending({ kind: "before", id: "a1" }, "d1"),
      emptyPending({ kind: "after", id: "a1" }, "d2"),
      emptyPending({ kind: "under", id: "b" }, "d3"),
    ])),
  ).toEqual([
    "/a",
    "(d1)", // before the row it was opened on
    "/a/a1",
    "/a/a1/a1x",
    "(d2)", // at the FLOOR of the subtree the anchor parents
    "/a/a2",
    "/b",
    "(d3)", // the first-child's seat
  ])
})

test("a folded branch's floor is the row itself", () => {
  expect(
    spelled(wired(tree, new Set(["a1"]), [emptyPending({ kind: "after", id: "a1" }, "d1")])),
  ).toEqual(["/a", "/a/a1", "(d1)", "/a/a2", "/b"])
})

test("drafts on the same spot keep the order they were laid out in", () => {
  // Enter Enter Enter parks the earlier empties, and the FIRST one laid is
  // the FIRST line a person reaches walking down — the order Ghosts.tsx
  // paints them in is the order this answers.
  expect(
    spelled(wired(tree, new Set(), [
      emptyPending({ kind: "after", id: "a2" }, "d1"),
      emptyPending({ kind: "after", id: "a2" }, "d2"),
      emptyPending({ kind: "after", id: "a2" }, "d3"),
    ])),
  ).toEqual(["/a", "/a/a1", "/a/a1/a1x", "/a/a2", "(d1)", "(d2)", "(d3)", "/b"])
})

test("an empty page's start line is the whole walk", () => {
  expect(
    spelled(wired([], new Set(), [emptyPending({ kind: "first", file: "house.olai" }, "d1")])),
  ).toEqual(["(d1)"])
})

test("no drafts is the flattening itself, and the same values it answers", () => {
  const list = wired(tree, new Set(), [])
  expect(spelled(list)).toEqual(keys(flatten(tree, new Set())))
  expect(list.every((one) => one.kind === "row")).toBe(true)
})

// ── the structure keys over a blank ───────────────────────────────────

test("Tab joins the flight of the row directly above the blank", () => {
  // `a` has a subtree — the floor-seat's blank trails a1, a1x, a2: Tab joins
  // the LAST of those, one level deeper than the seat.
  expect(reanchored(tree, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ kind: "after", id: "a2" })
  // The row above at the blank's OWN depth: Tab slips under it — first-child's
  // seat.
  expect(reanchored(tree, new Set(), { kind: "after", id: "a1x" }, "in"))
    .toEqual({ kind: "under", id: "a1x" })
  // `b` is top-level and last: the wire's row above the blank is b itself.
  expect(reanchored(tree, new Set(), { kind: "after", id: "b" }, "in"))
    .toEqual({ kind: "under", id: "b" })
  // The first-child's seat is as deep as that side of the shape goes.
  expect(reanchored(tree, new Set(), { kind: "before", id: "a1" }, "in")).toBeUndefined()
})

test("Shift+Tab slips the blank out of the sibling list it sits in", () => {
  expect(reanchored(tree, new Set(), { kind: "after", id: "a2" }, "out"))
    .toEqual({ kind: "after", id: "a" })
  // The first-child's seat out: right below the branch that held it — a seat
  // among the PARENT's siblings is what Shift+Tab means everywhere else.
  expect(reanchored(tree, new Set(), { kind: "under", id: "a1" }, "out"))
    .toEqual({ kind: "after", id: "a1" })
  // A top-level seat is as far out as a blank gets.
  expect(reanchored(tree, new Set(), { kind: "after", id: "b" }, "out")).toBeUndefined()
})

test("Alt+Shift walks the blank one slot within its sibling list", () => {
  // The single row above the seat: the blank comes out directly before it —
  // the seat the eye already saw it in ONE place rather than two.
  expect(reanchored(tree, new Set(), { kind: "after", id: "a1" }, "up"))
    .toEqual({ kind: "before", id: "a1" })
  // Two slots up from after-a2: past a2's whole subtree and above it.
  expect(reanchored(tree, new Set(), { kind: "after", id: "a1x" }, "up"))
    .toEqual({ kind: "before", id: "a1x" })
  expect(reanchored(tree, new Set(), { kind: "after", id: "a2" }, "up"))
    .toEqual({ kind: "after", id: "a1" })
  expect(reanchored(tree, new Set(), { kind: "before", id: "a2" }, "down"))
    .toEqual({ kind: "after", id: "a2" })
  // Both ENDS are where the key says nothing — the blank does not wrap round
  // any more than a row does.
  expect(reanchored(tree, new Set(), { kind: "before", id: "a1" }, "up")).toBeUndefined()
  expect(reanchored(tree, new Set(), { kind: "after", id: "b" }, "down")).toBeUndefined()
})
