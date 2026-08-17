import { expect, test } from "bun:test"

import { PANE_MIN_PX, PANE_RAIL_PX, snap } from "./geometry.ts"

test("a small travel redistributes two siblings", () => {
  const next = snap([0.5, 0.5], 100, 1000, 0, 1)
  expect(next[0]!).toBeCloseTo(0.6, 5)
  expect(next[1]!).toBeCloseTo(0.4, 5)
})

test("the same arithmetic on a column uses the extent, not the name", () => {
  // dy + height, not dx + width: the caller picks the axis.
  const next = snap([0.5, 0.5], 100, 1000, 0, 1)
  expect(next[0]!).toBeCloseTo(0.6, 5)
})

test("a child that would land below the minimum collapses to 0", () => {
  const next = snap([0.5, 0.5], 800, 1000, 0, 1)
  expect(next[1]).toBe(0)
  expect(next[0]!).toBeGreaterThan(0)
  expect(PANE_MIN_PX).toBe(180)
  expect(PANE_RAIL_PX).toBe(36)
})

test("a zero extent does not invent a fraction", () => {
  expect(snap([0.5, 0.5], 50, 0, 0, 1)).toEqual([0.5, 0.5])
})
