import { expect, test } from "bun:test"

import { type Aimed, aimAt } from "./aim.ts"
import type { Placed } from "./plan.ts"
const placed = (id: string, depth: number, at: number, from: number): Placed => ({
  key: `/${id}`,
  id,
  parent: null,
  into: id,
  depth,
  top: at * 20,
  bottom: at * 20 + 20,
  left: from + depth * 32,
  right: from + 400,
})

const pane = (file: string, left: number, rows: ReadonlyArray<Placed>): Aimed => ({
  file,
  box: { top: 0, left, width: 500, height: 800 },
  placed: rows,
})

const here = pane("house.olai", 0, [placed("one", 0, 0, 20), placed("two", 0, 1, 20)])
const there = pane("house.olai", 500, [placed("three", 0, 0, 520), placed("four", 0, 1, 520)])
const elsewhere = pane("garden.olai", 500, [])

const asked = (fields: ReadonlyArray<Aimed>, x: number, y: number): string => {
  const aim = aimAt(fields, "house.olai", x, y)
  if (aim === null) return "nothing"
  if (aim.kind === "refused") return `refused by ${aim.refusal.file}`
  return `under ${aim.landing.parent ?? "(top)"} after ${aim.landing.after ?? "(first)"}`
}

test("the pane the pointer is over is the pane the drop is planned in", () => {
  expect(asked([here, there], 24, 25)).toBe("under (top) after one")
  expect(asked([here, there], 524, 25)).toBe("under (top) after three")
})

test("a pointer outside every pane still aims at the nearest one", () => {
  expect(asked([here, there], -300, 25)).toBe("under (top) after one")
  expect(asked([here, there], 2_000, 25)).toBe("under three after (first)")
  expect(asked([here], 2_000, 25)).toBe("under one after (first)")
})

test("a pane drawing no row of the carried file refuses, by name, before the drop", () => {
  expect(asked([here, elsewhere], 524, 25)).toBe("refused by garden.olai")
  expect(asked([here, elsewhere], 24, 25)).toBe("under (top) after one")
})

test("the refusal says which files, and is drawn over the pane that gave it", () => {
  const aim = aimAt([here, elsewhere], "house.olai", 524, 25)
  expect(aim?.kind).toBe("refused")
  if (aim?.kind !== "refused") return
  expect(aim.refusal.why).toContain("garden.olai")
  expect(aim.refusal.why).toContain("house.olai")
  expect(aim.refusal).toMatchObject({ left: 500, width: 500 })
})

test("a pane of the SAME file with nothing left to land beside says a different thing", () => {
  const inside = pane("house.olai", 500, [])
  const aim = aimAt([here, inside], "house.olai", 524, 25)
  expect(aim?.kind).toBe("refused")
  if (aim?.kind !== "refused") return
  expect(aim.refusal.why).toContain("every row in this pane is part of what you’re dragging")
  expect(aim.refusal.why).not.toContain("Move to…")
})

test("nowhere to aim at all is an answer, and it is silence", () => {
  expect(asked([], 24, 25)).toBe("nothing")
})

test("the panes tile the width and share the height, which is why X decides", () => {
  expect(asked([here, there], 24, 25)).toBe("under (top) after one")
  expect(asked([here, there], 524, 25)).toBe("under (top) after three")
  expect(asked([here, there], 24, 700)).toBe("under (top) after two")
  expect(asked([here, there], 524, 700)).toBe("under (top) after four")
})

test("a pane STACKED under another is picked by Y, which X alone could not do", () => {
  const above = { ...here, box: { top: 0, left: 0, width: 500, height: 400 } }
  const below = {
    ...there,
    box: { top: 400, left: 0, width: 500, height: 400 },
    placed: [placed("three", 0, 21, 20), placed("four", 0, 22, 20)],
  }
  expect(asked([above, below], 24, 25)).toBe("under (top) after one")
  expect(asked([above, below], 24, 445)).toBe("under (top) after three")
})
