import { expect, test } from "bun:test"

import { clamp } from "./prefs.ts"

/**
 * The pure half of a drag: how an edge maps a pointer delta onto a width.
 * The window listeners live in `resize.ts` and need a browser; the math is
 * what a regression would actually break about "dragging the wrong way".
 */
const widthAfter = (
  edge: "left" | "right",
  start: number,
  dx: number,
  min: number,
  max: number,
): number => {
  const raw = edge === "right" ? start + dx : start - dx
  return clamp(Math.round(raw), min, max)
}

test("right-edge drag grows to the right", () => {
  expect(widthAfter("right", 256, 40, 180, 480)).toBe(296)
  expect(widthAfter("right", 256, -40, 180, 480)).toBe(216)
})

test("left-edge drag grows to the left (chat dock)", () => {
  expect(widthAfter("left", 416, -40, 280, 720)).toBe(456)
  expect(widthAfter("left", 416, 40, 280, 720)).toBe(376)
})

test("a drag past the max is clamped", () => {
  expect(widthAfter("right", 256, 9999, 180, 480)).toBe(480)
  expect(widthAfter("left", 416, -9999, 280, 720)).toBe(720)
})

test("a drag past the min is clamped", () => {
  expect(widthAfter("right", 256, -9999, 180, 480)).toBe(180)
  expect(widthAfter("left", 416, 9999, 280, 720)).toBe(280)
})
