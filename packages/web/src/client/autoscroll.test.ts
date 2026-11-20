import { describe, expect, test } from "bun:test"

import { clientPx, edgeSpeed } from "./autoscroll.ts"

const HEIGHT = 1_000
const ZONE = 100
const FASTEST = 10

const speed = (y: number): number => edgeSpeed(clientPx(y), HEIGHT, ZONE, FASTEST)

describe("edgeSpeed", () => {
  test("the middle of the window is not an edge", () => {
    expect(speed(500)).toBe(0)
  })

  test("just inside a zone is a nudge, not a bolt", () => {
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
    expect(speed(-500)).toBe(-FASTEST)
    expect(speed(HEIGHT + 500)).toBe(FASTEST)
  })

  test("on a window shorter than two zones, the nearer edge wins", () => {
    expect(edgeSpeed(clientPx(10), 120, ZONE, FASTEST)).toBeLessThan(0)
    expect(edgeSpeed(clientPx(110), 120, ZONE, FASTEST)).toBeGreaterThan(0)
  })

  test("the boundary of a zone is not yet in it", () => {
    expect(speed(ZONE)).toBe(0)
    expect(speed(HEIGHT - ZONE)).toBe(0)
  })
})
