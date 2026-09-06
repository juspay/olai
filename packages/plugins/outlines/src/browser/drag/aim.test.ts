import { expect, test } from "bun:test"

import { type Aimed, aimAt } from "./aim.ts"
import type { Placed } from "./plan.ts"

/** A drawn row in one pane, as the aim sees one: 20px tall, indented 32px a
 *  level, its line starting `from` and running 400px. The numbers are a
 *  screen's, so a test reads as "the pointer is here". */
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

/** One pane of a split, 500px wide, with two roots drawn in it. */
const pane = (file: string, left: number, rows: ReadonlyArray<Placed>): Aimed => ({
  file,
  box: { top: 0, left, width: 500, height: 800 },
  placed: rows,
})

//   pane 0 (x 0–500)          pane 1 (x 500–1000)
//   house.olai                 house.olai
//     one     y 0–20             three   y 0–20
//     two      20–40             four     20–40
const here = pane("house.olai", 0, [placed("one", 0, 0, 20), placed("two", 0, 1, 20)])
const there = pane("house.olai", 500, [placed("three", 0, 0, 520), placed("four", 0, 1, 520)])
/** The same pane, showing another outline — so it draws no row of the file the
 *  drag is carrying, whatever it has on screen. */
const elsewhere = pane("garden.olai", 500, [])

/** What the pointer is asking for, as a sentence. */
const asked = (fields: ReadonlyArray<Aimed>, x: number, y: number): string => {
  const aim = aimAt(fields, "house.olai", x, y)
  if (aim === null) return "nothing"
  if (aim.kind === "refused") return `refused by ${aim.refusal.file}`
  return `under ${aim.landing.parent ?? "(top)"} after ${aim.landing.after ?? "(first)"}`
}

test("the pane the pointer is over is the pane the drop is planned in", () => {
  // The same y in both panes, and two different answers: pane 0's gap between
  // its own rows, pane 1's between its own.
  expect(asked([here, there], 24, 25)).toBe("under (top) after one")
  expect(asked([here, there], 524, 25)).toBe("under (top) after three")
})

test("a pointer outside every pane still aims at the nearest one", () => {
  // Out over the sidebar to the left of pane 0, and off the right edge of pane
  // 1. Clamping rather than answering `null` is what keeps a LONE page behaving
  // exactly as it did — there, everything is the nearest pane.
  expect(asked([here, there], -300, 25)).toBe("under (top) after one")
  // Off the right edge is pane 1 — and as far right as a pointer can go, which
  // is the deepest that gap offers, exactly as it would be in a lone page.
  expect(asked([here, there], 2_000, 25)).toBe("under three after (first)")
  expect(asked([here], 2_000, 25)).toBe("under one after (first)")
})

test("a pane drawing no row of the carried file refuses, by name, before the drop", () => {
  expect(asked([here, elsewhere], 524, 25)).toBe("refused by garden.olai")
  // ...and the pane the drag began in is unaffected: one pointer, one pane, one
  // answer.
  expect(asked([here, elsewhere], 24, 25)).toBe("under (top) after one")
})

test("the refusal says which files, and is drawn over the pane that gave it", () => {
  const aim = aimAt([here, elsewhere], "house.olai", 524, 25)
  expect(aim?.kind).toBe("refused")
  if (aim?.kind !== "refused") return
  expect(aim.refusal.why).toContain("garden.olai")
  expect(aim.refusal.why).toContain("house.olai")
  // The pane's own box, so the face covers what it is about.
  expect(aim.refusal).toMatchObject({ left: 500, width: 500 })
})

test("a pane of the SAME file with nothing left to land beside says a different thing", () => {
  // Every row drawn there is inside what the hand is holding — a zoom into the
  // branch being dragged, in the pane next door. Not a file rule, so not the
  // file rule's words.
  const inside = pane("house.olai", 500, [])
  const aim = aimAt([here, inside], "house.olai", 524, 25)
  expect(aim?.kind).toBe("refused")
  if (aim?.kind !== "refused") return
  expect(aim.refusal.why).toContain("inside what you are carrying")
  expect(aim.refusal.why).not.toContain("another file")
})

test("nowhere to aim at all is an answer, and it is silence", () => {
  // Every pane showing a day, a document or the Trash: no page draws a tree, so
  // there is nothing to land in and nothing to refuse either.
  expect(asked([], 24, 25)).toBe("nothing")
})

test("the panes tile the width and share the height, which is why X decides", () => {
  // The invariant `awayFrom` rests on, pinned rather than left implicit. Both
  // panes are measured against the same clipped viewport band, so every box
  // gives the SAME vertical answer and only the horizontal one can separate
  // them — which is what makes "the nearest pane" mean "the column the pointer
  // is in" for a row split, whatever y the pointer is at.
  expect(asked([here, there], 24, 25)).toBe("under (top) after one")
  expect(asked([here, there], 524, 25)).toBe("under (top) after three")
  // Far down the shared band, where only Y has changed: the same two answers,
  // deeper into each pane's own list.
  expect(asked([here, there], 24, 700)).toBe("under (top) after two")
  expect(asked([here, there], 524, 700)).toBe("under (top) after four")
})

test("a pane STACKED under another is picked by Y, which X alone could not do", () => {
  // The projection `../pane/geometry.ts` already names (`Axis = "row" | "col"`)
  // and does not draw yet. Two panes sharing a column: a horizontal-only
  // reading would give both the same answer and pick whichever came first,
  // silently. Pinned now so the day that split lands, the aim is already right
  // rather than plausibly wrong.
  const above = { ...here, box: { top: 0, left: 0, width: 500, height: 400 } }
  const below = {
    ...there,
    box: { top: 400, left: 0, width: 500, height: 400 },
    placed: [placed("three", 0, 21, 20), placed("four", 0, 22, 20)],
  }
  expect(asked([above, below], 24, 25)).toBe("under (top) after one")
  expect(asked([above, below], 24, 445)).toBe("under (top) after three")
})
