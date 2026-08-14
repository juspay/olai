import { expect, test } from "bun:test"

import { type Placed, planDrop } from "./plan.ts"

/** A drawn row, as the drop planner sees one: 20px tall, indented 32px a
 *  level, its line running from x=100 (at depth 0) to x=600. The numbers are a
 *  screen's, so the tests read as "the pointer is here" rather than as
 *  arithmetic. */
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

//   a          y 0–20    x 100
//   ├ a1        20–40      132
//   │ └ a1x     40–60      164
//   └ a2        60–80      132
//   b           80–100     100
const rows: ReadonlyArray<Placed> = [
  placed("/a", null, 0, 0),
  placed("/a/a1", "a", 1, 1),
  placed("/a/a1/a1x", "a1", 2, 2),
  placed("/a/a2", "a", 1, 3),
  placed("/b", null, 0, 4),
]

/** What a drop would do, as a sentence — so the tests read as the promise the
 *  indicator makes rather than as a struct. */
const asked = (x: number, y: number, over: ReadonlyArray<Placed> = rows): string => {
  const found = planDrop(over, x, y)
  if (found === null) return "nowhere"
  return `under ${found.parent ?? "(top)"} after ${found.after ?? "(first)"} at depth ${found.depth}`
}

test("the gap flips as the pointer crosses a line's middle", () => {
  // Above `a`'s middle: before it, at the top level.
  expect(asked(100, 9)).toBe("under (top) after (first) at depth 0")
  // Below it: the gap between `a` and `a1`.
  expect(asked(100, 11)).not.toBe("under (top) after (first) at depth 0")
})

test("nothing above the gap means joining the first row's siblings, at the front", () => {
  expect(asked(100, 0)).toBe("under (top) after (first) at depth 0")
  expect(asked(100, 0, [])).toBe("nowhere")
})

test("deeper than the row above is that row's FIRST child", () => {
  // Just under `a`, dragged one step in — the only way a pointer reaches a
  // branch that is empty or collapsed.
  expect(asked(140, 25)).toBe("under a after (first) at depth 1")
})

test("a gap holds one depth inside the row above, and no shallower than the row below", () => {
  // Between `a1x` and `a2`. Far right asks for a child of `a1x`...
  expect(asked(900, 55)).toBe("under a1x after (first) at depth 3")
  // ...and far LEFT is clamped to `a2`'s own depth rather than the top level,
  // because a line drawn there would promise a shape leaving `a2` hanging.
  expect(asked(0, 55)).toBe("under a after a1 at depth 1")
})

test("the ancestor a shallow drop lands after is found however deep the row above is", () => {
  // At the end of the list, far left: the walk back passes `b` and stops at
  // the top level, so the row lands after `b`.
  expect(asked(0, 95)).toBe("under (top) after b at depth 0")
  // One step in, and it is `b`'s first child instead.
  expect(asked(140, 95)).toBe("under b after (first) at depth 1")
})

test("the line is drawn along the gap and offset to the depth it promises", () => {
  // Under `a` at depth 1: on `a`'s bottom edge, one indent in from where depth
  // 0 starts, running to the right edge of the row it sits beside.
  expect(planDrop(rows, 140, 25)).toMatchObject({ top: 20, left: 132, width: 468 })
  // The same gap, asked at the top level (which that gap does not offer) —
  // proving the line follows the ANSWER rather than the pointer.
  expect(planDrop(rows, 0, 95)).toMatchObject({ top: 100, left: 100 })
})

test("the indent is read off the rows, and falls back when the page has one depth", () => {
  // Every row at the top level: nothing on screen says how far a level
  // indents, so the fallback decides how far right the pointer must go to ask
  // for the one extra depth such a page offers.
  const flat = [placed("/a", null, 0, 0), placed("/b", null, 0, 1)]
  expect(asked(100, 25, flat)).toBe("under (top) after a at depth 0")
  expect(asked(140, 25, flat)).toBe("under a after (first) at depth 1")
})
