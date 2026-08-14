import { expect, test } from "bun:test"

import { depthAt, depthsAt, dropAt, gapAt, indentOf, type Placed, planDrop } from "./plan.ts"

/** A drawn row, as the drop planner sees one: 20px tall, indented 32px a
 *  level. The numbers are a screen's, so the tests read as "the pointer is
 *  here" rather than as arithmetic. */
const placed = (
  key: string,
  parent: string | null,
  depth: number,
  at: number,
): Placed => ({
  key,
  id: key.slice(key.lastIndexOf("/") + 1),
  parent,
  depth,
  top: at * 20,
  bottom: at * 20 + 20,
  left: 100 + depth * 32,
  right: 600,
})

//   a          0–20
//   ├ a1      20–40
//   │ └ a1x   40–60
//   └ a2      60–80
//   b         80–100
const rows: ReadonlyArray<Placed> = [
  placed("/a", null, 0, 0),
  placed("/a/a1", "a", 1, 1),
  placed("/a/a1/a1x", "a1", 2, 2),
  placed("/a/a2", "a", 1, 3),
  placed("/b", null, 0, 4),
]

test("the indent is read off the rows, not off a constant", () => {
  expect(indentOf(rows)).toBe(32)
  // One depth on screen is a page that cannot say — the caller's fallback.
  expect(indentOf([placed("/a", null, 0, 0), placed("/b", null, 0, 1)])).toBeNull()
  expect(indentOf([])).toBeNull()
})

test("the gap flips as the pointer crosses a line's middle", () => {
  expect(gapAt(rows, 5)).toBe(0)
  expect(gapAt(rows, 9)).toBe(0)
  expect(gapAt(rows, 11)).toBe(1)
  expect(gapAt(rows, 95)).toBe(5)
})

test("a gap holds one depth inside the row above, and no shallower than the row below", () => {
  // Between `a1x` and `a2`: as deep as a child of `a1x`, no shallower than
  // `a2` — a line drawn at the top level there would promise a shape that
  // leaves `a2` hanging above it.
  expect(depthsAt(rows, 3)).toEqual({ min: 1, max: 3 })
  // The end of the list: nothing below, so the top level is reachable.
  expect(depthsAt(rows, 5)).toEqual({ min: 0, max: 1 })
  // The very top: only the depth the first row is drawn at.
  expect(depthsAt(rows, 0)).toEqual({ min: 0, max: 0 })
  expect(depthsAt([], 0)).toEqual({ min: 0, max: 0 })
})

test("the pointer's x asks for a depth, and the gap clamps it", () => {
  // Far left, at the end of the list: the top level.
  expect(depthAt(rows, 5, 0, 32)).toBe(0)
  // Dragged right, past one step: a child of `b`.
  expect(depthAt(rows, 5, 140, 32)).toBe(1)
  // ...and no further, however far right the pointer goes.
  expect(depthAt(rows, 5, 900, 32)).toBe(1)
})

test("nothing above the gap means joining the first row's siblings, at the front", () => {
  expect(dropAt(rows, 0, 0)).toEqual({ parent: null, after: null, gap: 0, depth: 0 })
  expect(dropAt([], 0, 0)).toBeNull()
})

test("deeper than the row above is that row's FIRST child", () => {
  // The only way a pointer reaches a branch that is empty or collapsed.
  expect(dropAt(rows, 1, 1)).toEqual({ parent: "a", after: null, gap: 1, depth: 1 })
})

test("anything else lands after the last row drawn at that depth", () => {
  // Between `a1x` and `a2`, asked at `a1`'s depth: after `a1`, under `a`.
  expect(dropAt(rows, 3, 1)).toEqual({ parent: "a", after: "a1", gap: 3, depth: 1 })
  // The same gap at the top level is not offered (see the clamp above), but
  // the walk back answers it correctly when it is: after `a`, at the top.
  expect(dropAt(rows, 3, 0)).toEqual({ parent: null, after: "a", gap: 3, depth: 0 })
  // At the end of the list, at the top level: after `b`.
  expect(dropAt(rows, 5, 0)).toEqual({ parent: null, after: "b", gap: 5, depth: 0 })
})

test("the ancestor a shallow drop lands after is found however deep the row above is", () => {
  // Below `a1x` (depth 2), asked at the top level: the walk passes `a1` and
  // stops at `a`, which is the sibling `a2` would follow.
  expect(dropAt(rows, 3, 0)?.after).toBe("a")
})

test("a pointer over the page is one call", () => {
  // Middle of the last row, far left — the top level, after `b`.
  expect(planDrop(rows, 100, 95)).toEqual({
    parent: null,
    after: "b",
    gap: 5,
    depth: 0,
  })
  // Just under `a`, dragged one step in: `a`'s first child.
  expect(planDrop(rows, 140, 25)).toEqual({
    parent: "a",
    after: null,
    gap: 1,
    depth: 1,
  })
})
