import { expect, test } from "bun:test"

import { offsetAt } from "./point.ts"
const ten = (text: string): number => text.length * 10

const box = { left: 100, width: 180 }

test("a click on the first glyph is offset 0", () => {
  expect(offsetAt("choose the handles", box, 104, ten)).toBe(0)
})

test("a click 8px in is the first character, not the end of the line", () => {
  expect(offsetAt("choose the handles", box, 108, ten)).toBe(1)
})

test("a click in the middle of a glyph picks the closer offset", () => {
  expect(offsetAt("choose the handles", box, 125, ten)).toBe(2)
  expect(offsetAt("choose the handles", box, 126, ten)).toBe(3)
})

test("a click on the last glyph is the last offset, not past it", () => {
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
