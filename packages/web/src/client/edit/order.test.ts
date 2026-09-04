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
  row("a", "/a", [
    row("a1", "/a/a1", [row("a1x", "/a/a1/a1x")]),
    row("a2", "/a/a2"),
    row("a3", "/a/a3"),
  ]),
  row("b", "/b"),
]

const keys = (rows: ReadonlyArray<Row>): ReadonlyArray<string> => rows.map((r) => r.key)

test("the drawn order is the order they are painted in", () => {
  expect(keys(flatten(tree, new Set()))).toEqual([
    "/a",
    "/a/a1",
    "/a/a1/a1x",
    "/a/a2",
    "/a/a3",
    "/b",
  ])
})

test("a folded branch's children are not on screen, so they are not in it", () => {
  expect(keys(flatten(tree, new Set(["a1"])))).toEqual([
    "/a",
    "/a/a1",
    "/a/a2",
    "/a/a3",
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
    "/a/a3",
    "/b",
  ])
})

test("the arrows step through what is drawn, across levels", () => {
  // The one thing worth getting wrong: `↓` from the last child of a branch
  // lands on the next row wherever it is in the shape.
  expect(neighbour(flatten(tree, new Set()), "/a/a1/a1x", 1)?.key).toBe("/a/a2")
  expect(neighbour(flatten(tree, new Set()), "/a/a3", 1)?.key).toBe("/b")
  expect(neighbour(flatten(tree, new Set()), "/b", -1)?.key).toBe("/a/a3")
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
    "/a/a3",
    "/b",
    "(d3)", // the first-child's seat
  ])
})

test("a folded branch's floor is the row itself", () => {
  expect(
    spelled(wired(tree, new Set(["a1"]), [emptyPending({ kind: "after", id: "a1" }, "d1")])),
  ).toEqual(["/a", "/a/a1", "(d1)", "/a/a2", "/a/a3", "/b"])
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
  ).toEqual(["/a", "/a/a1", "/a/a1/a1x", "/a/a2", "(d1)", "(d2)", "(d3)", "/a/a3", "/b"])
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

const seat = (
  rows: ReadonlyArray<Row> = tree,
  collapsed: ReadonlySet<string> = new Set(),
  at: Parameters<typeof reanchored>[2],
  way: Parameters<typeof reanchored>[3],
  drafts: Parameters<typeof reanchored>[4] = [],
) => reanchored(rows, collapsed, at, way, drafts)

test("Tab seats the blank as the previous sibling's LAST child, one level in", () => {
  // The seat `after:a` is the floor of a's subtree: the row above AT THE
  // SEAT'S OWN DEPTH is `a` itself, and `a3` is its last child — the blank
  // stays on its line and indents ONE level, exactly as a written row moves.
  expect(seat(tree, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" } })
  // The row above is childless: the child's seat is the whole of it.
  expect(seat(tree, new Set(), { kind: "after", id: "a1x" }, "in"))
    .toEqual({ at: { kind: "under", id: "a1x" } })
  // `b` is top-level and last: the wire's row above the blank is b itself.
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "in"))
    .toEqual({ at: { kind: "under", id: "b" } })
  // The first-child's seat is as deep as that side of the shape goes.
  expect(seat(tree, new Set(), { kind: "before", id: "a1" }, "in")).toBeUndefined()
})

test("Tab is ONE level, however deep the trailing subtree", () => {
  // THE REVIEW PROBE (#493): in a chain three levels deep the old answer was
  // `after: a1xy` — three levels on one keystroke, and Shift+Tab did not put
  // the blank back. The rule is the server's own `move in`: the child the
  // row above would APPEND.
  const chain: ReadonlyArray<Row> = [
    row("a", "/a", [
      row("a1", "/a/a1", [
        row("a1x", "/a/a1/a1x", [row("a1xy", "/a/a1/a1x/a1xy")]),
      ]),
    ]),
    row("b", "/b"),
  ]
  expect(seat(chain, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  // ...and the way back is a round trip, not an after:a1x half-way.
  expect(seat(chain, new Set(), { kind: "after", id: "a1" }, "out"))
    .toEqual({ at: { kind: "after", id: "a" } })
})

test("Tab into a FOLDED branch names the fold to lift", () => {
  // Without the OPEN half the answer `after: a3` names a row nothing draws:
  // the ghost would vanish — drawn under a triangle that says collapsed, the
  // exact picture the review of #493 filed. The blank's seat is on the page
  // once the branch opens — Workflowy's own answer.
  expect(seat(tree, new Set(["a"]), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" }, open: { id: "a", file: "house.olai" } })
  // ...and nothing to lift when the branch already reads open.
  expect(seat(tree, new Set(), { kind: "after", id: "a" }, "in"))
    .toEqual({ at: { kind: "after", id: "a3" } })
})

test("Shift+Tab slips the blank out of the sibling list it sits in", () => {
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "out"))
    .toEqual({ at: { kind: "after", id: "a" } })
  // The first-child's seat out: right below the branch that held it — a seat
  // among the PARENT's siblings is what Shift+Tab means everywhere else.
  expect(seat(tree, new Set(), { kind: "under", id: "a1" }, "out"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  // A top-level seat is as far out as a blank gets.
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "out")).toBeUndefined()
})

test("Alt+Shift walks the blank one slot within its sibling list", () => {
  // The single row above the seat: the blank comes out directly before it —
  // the seat the eye already saw it in ONE place rather than two.
  expect(seat(tree, new Set(), { kind: "after", id: "a1" }, "up"))
    .toEqual({ at: { kind: "before", id: "a1" } })
  // Past a1x's whole subtree and above it — one slot deeper than a row.
  expect(seat(tree, new Set(), { kind: "after", id: "a1x" }, "up"))
    .toEqual({ at: { kind: "before", id: "a1x" } })
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "up"))
    .toEqual({ at: { kind: "after", id: "a1" } })
  // THE THREE-SIBLING PIN (grok's review of #493): three rows above the seat,
  // one press is one slot — past a3 and above its subtree, `after a2` — NOT
  // the walk's own first sibling, which is what one press used to make of a
  // two-sibling list by coincidence of the seat.
  expect(seat(tree, new Set(), { kind: "after", id: "a3" }, "up"))
    .toEqual({ at: { kind: "after", id: "a2" } })
  expect(seat(tree, new Set(), { kind: "before", id: "a2" }, "down"))
    .toEqual({ at: { kind: "after", id: "a2" } })
  // Both ENDS are where the key says nothing — the blank does not wrap round
  // any more than a row does.
  expect(seat(tree, new Set(), { kind: "before", id: "a1" }, "up")).toBeUndefined()
  expect(seat(tree, new Set(), { kind: "after", id: "b" }, "down")).toBeUndefined()
})

test("a parked blank at the seat's depth is a WALL the move keys may not cross", () => {
  // The wire is the same one the plain arrows read — three blanks at one
  // anchor are three lines and `↑` steps onto each. A move key may NOT step
  // over one though: an anchor cannot name a blank, so nothing here can
  // spell "between d1 and d2" — one press that crosses it is a three-line
  // jump, which was the other half of the review's finding. The ordering of
  // blanks at one seat is the PR's stated deferral.
  const cluster = [emptyPending({ kind: "after", id: "a2" }, "d1"), emptyPending({ kind: "after", id: "a2" }, "d2")]
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "up", cluster)).toBeUndefined()
  expect(seat(tree, new Set(), { kind: "after", id: "a2" }, "down", cluster))
    .toEqual({ at: { kind: "after", id: "a3" } })
  // The same wall one anchor over — below this time.
  expect(
    seat(tree, new Set(), { kind: "after", id: "a2" }, "down", [emptyPending({ kind: "before", id: "a3" }, "d1")]),
  ).toBeUndefined()
  // What is NOT a wall: a parked line at a DEEPER seat, riding a row's flight
  // — the same as any child of the row the press is crossing.
  expect(
    seat(tree, new Set(), { kind: "after", id: "a2" }, "up", [emptyPending({ kind: "after", id: "a1x" }, "d1")]),
  ).toEqual({ at: { kind: "after", id: "a1" } })
})
