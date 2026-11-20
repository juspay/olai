import { describe, expect, test } from "bun:test"

import { usageOf } from "./usage.ts"

describe("how full the context is, as a header line", () => {
  test("the numbers the agent actually sends", () => {
    expect(usageOf({ used: 22102, size: 1000000 })).toBe("22k/1M")
    expect(usageOf({ used: 22925, size: 200000 })).toBe("23k/200k")
  })

  test("a conversation that has spent nothing says so", () => {
    expect(usageOf({ used: 0, size: 200000 })).toBe("0/200k")
    expect(usageOf({ used: 847, size: 200000 })).toBe("847/200k")
    expect(usageOf({ used: 999, size: 200000 })).toBe("999/200k")
    expect(usageOf({ used: 1000, size: 200000 })).toBe("1k/200k")
  })

  test("nearly a million is not `1000k`", () => {
    expect(usageOf({ used: 999_600, size: 1_000_000 })).toBe("1M/1M")
    expect(usageOf({ used: 999_400, size: 1_000_000 })).toBe("999k/1M")
  })

  test("millions carry one decimal, and never a trailing zero", () => {
    expect(usageOf({ used: 1_500_000, size: 2_000_000 })).toBe("1.5M/2M")
    expect(usageOf({ used: 1_000_000, size: 1_000_000 })).toBe("1M/1M")
  })

  test("a context fuller than its window is drawn as it was reported", () => {
    expect(usageOf({ used: 240000, size: 200000 })).toBe("240k/200k")
  })

  test("no report is no line, which is every session before its first turn", () => {
    expect(usageOf(null)).toBeNull()
  })
})
