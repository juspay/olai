import { describe, expect, test } from "bun:test"

import type { Line } from "./lines.ts"
import { planSweep } from "./sweep.ts"

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
    expect(planSweep(ROWS, 45, 55)?.run?.keys).toEqual(["/a/b/c"])
  })

  test("a band that touches a row's edge has crossed it", () => {
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
