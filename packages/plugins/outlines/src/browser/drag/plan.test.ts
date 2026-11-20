import { expect, test } from "bun:test"

import { type Placed, planDrop } from "./plan.ts"
const placed = (
  key: string,
  parent: string | null,
  depth: number,
  at: number,
  into?: string | null,
): Placed => {
  const id = key.slice(key.lastIndexOf("/") + 1)
  return {
    key,
    id,
    parent,
    into: into === undefined ? id : into,
    depth,
    top: at * 20,
    bottom: at * 20 + 20,
    left: 100 + depth * 32,
    right: 600,
  }
}

const rows: ReadonlyArray<Placed> = [
  placed("/a", null, 0, 0),
  placed("/a/a1", "a", 1, 1),
  placed("/a/a1/a1x", "a1", 2, 2),
  placed("/a/a2", "a", 1, 3),
  placed("/b", null, 0, 4),
]

const asked = (x: number, y: number, over: ReadonlyArray<Placed> = rows): string => {
  const found = planDrop(over, x, y)
  if (found === null) return "nowhere"
  return `under ${found.parent ?? "(top)"} after ${found.after ?? "(first)"} at depth ${found.depth}`
}

test("the gap flips as the pointer crosses a line's middle", () => {
  expect(asked(100, 9)).toBe("under (top) after (first) at depth 0")
  expect(asked(100, 11)).not.toBe("under (top) after (first) at depth 0")
})

test("nothing above the gap means joining the first row's siblings, at the front", () => {
  expect(asked(100, 0)).toBe("under (top) after (first) at depth 0")
  expect(asked(100, 0, [])).toBe("nowhere")
})

test("deeper than the row above is that row's FIRST child", () => {
  expect(asked(140, 25)).toBe("under a after (first) at depth 1")
})

test("a gap holds one depth inside the row above, and no shallower than the row below", () => {
  expect(asked(900, 55)).toBe("under a1x after (first) at depth 3")
  expect(asked(0, 55)).toBe("under a after a1 at depth 1")
})

test("the ancestor a shallow drop lands after is found however deep the row above is", () => {
  expect(asked(0, 95)).toBe("under (top) after b at depth 0")
  expect(asked(140, 95)).toBe("under b after (first) at depth 1")
})

test("the line is drawn along the gap and offset to the depth it promises", () => {
  expect(planDrop(rows, 140, 25)).toMatchObject({ top: 20, left: 132, width: 468 })
  expect(planDrop(rows, 0, 95)).toMatchObject({ top: 100, left: 100 })
})

test("a row nothing may hang under is a line to drop BESIDE, never INTO", () => {
  const withMirror: ReadonlyArray<Placed> = [
    placed("/a", null, 0, 0),
    placed("/m", null, 0, 1, null),
    placed("/b", null, 0, 2),
  ]
  expect(asked(900, 45, withMirror)).toBe("under (top) after m at depth 0")
  expect(asked(900, 45, [placed("/a", null, 0, 0), placed("/m", null, 0, 1), placed("/b", null, 0, 2)]))
    .toBe("under m after (first) at depth 1")
})

test("a mirror of a node in THIS file is a parent, and it is the node that is named", () => {
  const sameFile: ReadonlyArray<Placed> = [
    placed("/a", null, 0, 0),
    placed("/kitchen-herbs", null, 0, 1, "herbs"),
    placed("/b", null, 0, 2),
  ]
  expect(asked(900, 45, sameFile)).toBe("under herbs after (first) at depth 1")
})

test("the indent is read off the rows, and falls back when the page has one depth", () => {
  const flat = [placed("/a", null, 0, 0), placed("/b", null, 0, 1)]
  expect(asked(100, 25, flat)).toBe("under (top) after a at depth 0")
  expect(asked(140, 25, flat)).toBe("under a after (first) at depth 1")
})
