import { describe, expect, test } from "bun:test"

import { anchoredTo } from "./anchor.ts"

const LAPTOP = { width: 1440, height: 900 }

const pillAt = (left: number, top: number) => ({ left, top, bottom: top + 30 })

describe("the panel's corner", () => {
  test("opens upward from the pill, aligned to it, when there is room", () => {
    const at = anchoredTo(pillAt(16, 820), LAPTOP)
    expect(at.left).toBe(16)
    expect(at.side).toBe("bottom")
    expect(at.offset).toBe(900 - 820 + 8)
    expect(at.width).toBe(384)
    expect(at.maxHeight).toBe(820 - 8 - 12)
  })

  test("is pushed back inside when the pill is near the right edge", () => {
    const at = anchoredTo(pillAt(1400, 820), LAPTOP)
    expect(at.left).toBe(1440 - 384 - 12)
    expect(at.left + at.width).toBeLessThanOrEqual(1440 - 12)
  })

  test("narrows to fit a phone rather than running off it", () => {
    const at = anchoredTo(pillAt(12, 700), { width: 390, height: 844 })
    expect(at.width).toBe(390 - 24)
    expect(at.left).toBe(12)
  })

  test("flips downward when the pill is too high to open upward", () => {
    const at = anchoredTo(pillAt(16, 20), LAPTOP)
    expect(at.side).toBe("top")
    expect(at.offset).toBe(50 + 8)
    expect(at.maxHeight).toBeGreaterThan(0)
  })

  test("never asks for a negative height, however little room there is", () => {
    const at = anchoredTo(pillAt(16, 4), { width: 1440, height: 20 })
    expect(at.maxHeight).toBe(0)
    expect(at.width).toBeGreaterThanOrEqual(0)
  })
})
