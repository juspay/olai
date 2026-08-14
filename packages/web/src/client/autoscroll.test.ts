/**
 * The edge zones' arithmetic — the sign, the ramp, and what happens PAST the
 * edge, which is the case a naive ratio gets wrong and a mouse cannot easily
 * be made to try.
 *
 * A 1000px window with 100px zones throughout, so every number below reads as
 * a fraction without arithmetic.
 */

import { describe, expect, test } from "bun:test"

import { edgeSpeed } from "./autoscroll.ts"

const HEIGHT = 1_000
const ZONE = 100
const FASTEST = 10

const speed = (y: number): number => edgeSpeed(y, HEIGHT, ZONE, FASTEST)

describe("edgeSpeed", () => {
  test("the middle of the window is not an edge", () => {
    expect(speed(500)).toBe(0)
  })

  test("just inside a zone is a nudge, not a bolt", () => {
    // The whole reason the speed ramps: a constant one makes the page run away
    // the instant a hand strays near the bottom of the screen.
    expect(speed(HEIGHT - ZONE + 1)).toBeCloseTo(0.1, 5)
    expect(speed(ZONE - 1)).toBeCloseTo(-0.1, 5)
  })

  test("the edge itself is the fastest it goes", () => {
    expect(speed(0)).toBe(-FASTEST)
    expect(speed(HEIGHT)).toBe(FASTEST)
  })

  test("up is negative and down is positive", () => {
    expect(speed(20)).toBeLessThan(0)
    expect(speed(HEIGHT - 20)).toBeGreaterThan(0)
  })

  test("a pointer dragged OFF the window is at full speed, never past it", () => {
    // The gesture a person actually makes when the row they want is a screen
    // away: they keep pulling. Without the clamp this is an unbounded speed,
    // and one frame of it jumps the page by more than a screen.
    expect(speed(-500)).toBe(-FASTEST)
    expect(speed(HEIGHT + 500)).toBe(FASTEST)
  })

  test("on a window shorter than two zones, the nearer edge wins", () => {
    // 120px tall with 100px zones: every point is in both. A rule that checked
    // the top first would make the bottom half of such a window scroll UP.
    expect(edgeSpeed(10, 120, ZONE, FASTEST)).toBeLessThan(0)
    expect(edgeSpeed(110, 120, ZONE, FASTEST)).toBeGreaterThan(0)
  })

  test("the boundary of a zone is not yet in it", () => {
    expect(speed(ZONE)).toBe(0)
    expect(speed(HEIGHT - ZONE)).toBe(0)
  })
})
