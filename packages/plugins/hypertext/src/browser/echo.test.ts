import { describe, expect, test } from "bun:test"

import { echo } from "./echo.ts"

const reporting = () => {
  const heights = echo()
  let at = 0
  return {
    fresh: () => heights.fresh(),
    says: (height: number, frame: number) => heights.takes({ height, frame, at: (at += 16) }),
    later: (height: number, frame: number) =>
      heights.takes({ height, frame, at: (at += 1500) }),
  }
}

describe("a frame's height reports", () => {
  test("follow a page that grows after it has loaded, however often", () => {
    const heights = reporting()
    expect(heights.says(400, 630)).toBe(true)
    expect(heights.says(900, 400)).toBe(true)
    expect(heights.says(1500, 900)).toBe(true)
  })

  test("follow a page that shrinks again", () => {
    const heights = reporting()
    expect(heights.says(1500, 630)).toBe(true)
    expect(heights.says(900, 1500)).toBe(true)
    expect(heights.says(1500, 900)).toBe(true)
  })

  test("refuse a page whose height is the frame's, at whatever distance", () => {
    const heights = reporting()
    expect(heights.says(646, 630)).toBe(true)
    expect(heights.says(662, 646)).toBe(false)
    expect(heights.says(662, 646)).toBe(false)
  })

  test("refuse a page that reports the frame's own height back", () => {
    const heights = reporting()
    expect(heights.says(630, 630)).toBe(true)
    expect(heights.says(630, 630)).toBe(false)
  })

  test("stop after one rung when a page sized in viewport units keeps reporting", () => {
    const heights = reporting()
    let frame = 630
    const taken = Array.from({ length: 20 }, () => {
      const said = frame + 96
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken.filter(Boolean)).toHaveLength(1)
    expect(frame).toBe(726)
  })

  test("read a gap a rounded pixel out as the same gap", () => {
    const heights = reporting()
    expect(heights.says(646, 630)).toBe(true)
    expect(heights.says(663, 646)).toBe(false)
  })

  test("let a reader return to a height they left", () => {
    const heights = reporting()
    expect(heights.says(400, 630)).toBe(true)
    expect(heights.says(1200, 400)).toBe(true)
    expect(heights.says(400, 1200)).toBe(true)
    expect(heights.says(1200, 400)).toBe(true)
  })

  test("follow a reflow without being told the width changed", () => {
    const heights = reporting()
    expect(heights.says(400, 630)).toBe(true)
    expect(heights.says(700, 400)).toBe(true)
  })

  test("start over for the next document", () => {
    const heights = reporting()
    expect(heights.says(646, 630)).toBe(true)
    expect(heights.says(662, 646)).toBe(false)
    heights.fresh()
    expect(heights.says(662, 646)).toBe(true)
  })

  test("stop following a page that keeps sending the frame back the other way", () => {
    const heights = reporting()
    const taken = Array.from({ length: 40 }, (_, at) =>
      at % 2 === 0 ? heights.says(1200, 400) : heights.says(400, 1200))
    expect(taken.filter(Boolean).length).toBeLessThan(10)
    expect(taken.slice(-8).filter(Boolean)).toHaveLength(0)
  })

  test("follow a reader who toggles a section all afternoon", () => {
    const heights = reporting()
    const taken = Array.from({ length: 40 }, (_, at) =>
      at % 2 === 0 ? heights.later(1200, 400) : heights.later(400, 1200))
    expect(taken.filter(Boolean)).toHaveLength(40)
  })

  test("follow a page whose pictures land one after another, however many", () => {
    const heights = reporting()
    let frame = 96
    const taken = Array.from({ length: 20 }, (_, at) => {
      const said = 200 + 11 * at * (at + 7)
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken.filter(Boolean)).toHaveLength(20)
  })

  test("lose the step a page takes in lockstep with the frame, and win it back", () => {
    const heights = reporting()
    let frame = 630
    const taken = Array.from({ length: 6 }, (_, at) => {
      const said = 400 + at * 137
      const took = heights.says(said, frame)
      if (took) frame = said
      return took
    })
    expect(taken).toEqual([true, true, false, true, true, false])
    expect(frame).toBe(948)
  })

  test("and two frames do not share a record", () => {
    const one = reporting()
    const other = reporting()
    expect(one.says(646, 630)).toBe(true)
    expect(one.says(662, 646)).toBe(false)
    expect(other.says(662, 646)).toBe(true)
  })
})
