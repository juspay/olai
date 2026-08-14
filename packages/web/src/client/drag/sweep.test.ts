/**
 * The band's arithmetic: which rows a pull crosses, and which end is which.
 *
 * Rows are laid out at 20px each with no gap, so a y is easy to read as a row
 * number — the point of every case below is a RULE, and a fixture nobody can
 * hold in their head turns a failing rule into a puzzle about the fixture.
 */

import { describe, expect, test } from "bun:test"

import { type Line, planSweep } from "./sweep.ts"

/** Four rows down the page, the second and third indented — the shape that
 *  makes "a band is not a box" checkable: a rectangle drawn down the left of
 *  this would miss them. */
const ROWS: ReadonlyArray<Line> = [
  { key: "/a", top: 0, bottom: 20, left: 100, right: 500 },
  { key: "/a/b", top: 20, bottom: 40, left: 132, right: 500 },
  { key: "/a/b/c", top: 40, bottom: 60, left: 164, right: 500 },
  { key: "/d", top: 60, bottom: 80, left: 100, right: 500 },
]

describe("planSweep", () => {
  test("an empty page has nothing to sweep and nothing to draw", () => {
    expect(planSweep([], 10, 90)).toBeNull()
  })

  test("crosses every row the pull passed over, in drawn order", () => {
    expect(planSweep(ROWS, 10, 50)?.run?.keys).toEqual(["/a", "/a/b", "/a/b/c"])
  })

  test("the end it began at is the anchor, pulling down", () => {
    const run = planSweep(ROWS, 10, 50)?.run
    expect(run?.from).toBe("/a")
    expect(run?.to).toBe("/a/b/c")
  })

  test("...and pulling UP the two ends swap, which is what a person means", () => {
    const run = planSweep(ROWS, 50, 10)?.run
    expect(run?.keys).toEqual(["/a", "/a/b", "/a/b/c"])
    expect(run?.from).toBe("/a/b/c")
    expect(run?.to).toBe("/a")
  })

  test("depth is not read at all: the deepest row is crossed like any other", () => {
    // The whole of "a band, not a box". The pull is entirely to the LEFT of the
    // indented rows' own left edge, and they are crossed regardless — a
    // rectangle would have had to miss them.
    expect(planSweep(ROWS, 45, 55)?.run?.keys).toEqual(["/a/b/c"])
  })

  test("a band that touches a row's edge has crossed it", () => {
    // Clipping the top pixel of a row and not picking it is the answer nobody
    // means — this is deliberately not the drop planner's middle-crossing rule,
    // which is choosing between two gaps rather than passing over a line.
    expect(planSweep(ROWS, 58, 60)?.run?.keys).toEqual(["/a/b/c", "/d"])
  })

  test("a live sweep that has crossed nothing is still a band", () => {
    const sweep = planSweep(ROWS, 100, 140)
    expect(sweep?.run).toBeNull()
    expect(sweep?.top).toBe(100)
    expect(sweep?.bottom).toBe(140)
  })

  test("the band spans the rows' own width, whichever way it was pulled", () => {
    const down = planSweep(ROWS, 10, 50)
    const up = planSweep(ROWS, 50, 10)
    expect(down?.left).toBe(100)
    expect(down?.width).toBe(400)
    expect({ top: up?.top, bottom: up?.bottom }).toEqual({ top: 10, bottom: 50 })
  })

  test("a pull that has not left its own row yet is one row, read downward", () => {
    const run = planSweep(ROWS, 30, 30)?.run
    expect(run?.keys).toEqual(["/a/b"])
    expect(run?.from).toBe("/a/b")
    expect(run?.to).toBe("/a/b")
  })
})
