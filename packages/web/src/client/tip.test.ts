import { expect, test } from "bun:test"

import { clampedLeft } from "./tip.ts"

// The ordinary case: a tip starts where the thing it is about starts.
test("a tip that fits is drawn under its anchor", () => {
  expect(clampedLeft(120, 200, 1280)).toBe(120)
})

// The case the browser's own tooltip got wrong, and the reason this exists: a
// tip near the right edge is pulled back until it ends inside the window,
// rather than running off with the end of the sentence outside the screen.
test("a tip that would overflow is pulled back inside the window", () => {
  expect(clampedLeft(1100, 300, 1280)).toBe(1280 - 300 - 8)
})

// A phone, and a tip too wide for it: it is pinned to the left margin. Hanging
// off the RIGHT loses the end of the sentence; hanging off the LEFT loses the
// beginning, which is where reading starts.
test("a tip wider than the window is pinned to the left margin", () => {
  expect(clampedLeft(40, 600, 390)).toBe(8)
})

// The anchor itself can be at the very edge — a mark column on a deeply
// indented row, a window resized under an open tip.
test("a tip never starts left of the margin", () => {
  expect(clampedLeft(0, 100, 1280)).toBe(8)
})
