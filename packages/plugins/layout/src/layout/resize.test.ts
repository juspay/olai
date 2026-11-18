import { expect, test } from "bun:test"

import { widthAfter } from "./resize.ts"

test("a drag grows the panel with +dx", () => {
  expect(widthAfter(256, 40, 180, 480)).toBe(296)
  expect(widthAfter(256, -40, 180, 480)).toBe(216)
})

test("a drag past the max is clamped", () => {
  expect(widthAfter(256, 9999, 180, 480)).toBe(480)
})

test("a drag past the min is clamped", () => {
  expect(widthAfter(256, -9999, 180, 480)).toBe(180)
})
