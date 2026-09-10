import { expect, test } from "bun:test"

import { offsetAt } from "./point.ts"

/** A font in which every character is 10px, so an offset is a tenth of X. */
const ten = (text: string): number => text.length * 10

const box = { left: 100, width: 180 }

test("a click on the first glyph is offset 0", () => {
  expect(offsetAt("choose the handles", box, 104, ten)).toBe(0)
})

test("a click 8px in is the first character, not the end of the line", () => {
  // The gate: Playwright clicks 8px from the left of "choose the handles"
  // (18 characters). The old takeCaret put the caret at 18. 8px of a 10px
  // glyph is the right half, so the caret sits after that character — offset
  // 1, nowhere near 18.
  expect(offsetAt("choose the handles", box, 108, ten)).toBe(1)
})

test("a click in the middle of a glyph picks the closer offset", () => {
  // 25px into the string is halfway through character 2 (offsets 2 and 3
  // sit at 20 and 30). Closer to 3? 25-20=5, 30-25=5, ties go left.
  expect(offsetAt("choose the handles", box, 125, ten)).toBe(2)
  expect(offsetAt("choose the handles", box, 126, ten)).toBe(3)
})

test("a click on the last glyph is the last offset, not past it", () => {
  // box.width is 180 = 18 characters. A click on the right edge is still
  // on the last glyph (`x > width` is the filler).
  expect(offsetAt("choose the handles", box, 100 + 180, ten)).toBe(18)
})

test("a click past the glyphs is the end of the line, as absent", () => {
  expect(offsetAt("choose the handles", box, 100 + 181, ten)).toBeUndefined()
  expect(offsetAt("choose the handles", box, 400, ten)).toBeUndefined()
})

test("a click to the left of the box is offset 0", () => {
  expect(offsetAt("choose the handles", box, 90, ten)).toBe(0)
  expect(offsetAt("choose the handles", box, 100, ten)).toBe(0)
})

test("an empty title has nowhere else to put the caret", () => {
  expect(offsetAt("", box, 104, ten)).toBe(0)
  expect(offsetAt("", box, 400, ten)).toBe(0)
})
