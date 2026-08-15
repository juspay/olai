/**
 * The header's usage line, over values.
 *
 * The numbers here are the ones the pinned adapter (0.66.0) actually sent,
 * captured across four turns and a `/model` — including the turn where the
 * window itself moved, which is the case a fraction exists to make legible.
 */

import { describe, expect, test } from "bun:test"

import { usageOf } from "./usage.ts"

describe("how full the context is, as a header line", () => {
  test("the numbers the agent actually sends", () => {
    // Off the wire: a fresh session on a 1M model, then the same conversation
    // after `/model claude-opus-4-5` — where the WINDOW is what changed, which
    // a percentage would have hidden entirely (2% both times).
    expect(usageOf({ used: 22102, size: 1000000 })).toBe("22k/1M")
    expect(usageOf({ used: 22925, size: 200000 })).toBe("23k/200k")
  })

  test("a conversation that has spent nothing says so", () => {
    // `0k` is not a number anybody writes, and the opening of every session is
    // exactly where small counts are true.
    expect(usageOf({ used: 0, size: 200000 })).toBe("0/200k")
    expect(usageOf({ used: 847, size: 200000 })).toBe("847/200k")
    expect(usageOf({ used: 999, size: 200000 })).toBe("999/200k")
    expect(usageOf({ used: 1000, size: 200000 })).toBe("1k/200k")
  })

  test("nearly a million is not `1000k`", () => {
    // The handover is done on the rounded thousands, so a fraction never has
    // to be read twice to see that it is nearly full.
    expect(usageOf({ used: 999_600, size: 1_000_000 })).toBe("1M/1M")
    expect(usageOf({ used: 999_400, size: 1_000_000 })).toBe("999k/1M")
  })

  test("millions carry one decimal, and never a trailing zero", () => {
    expect(usageOf({ used: 1_500_000, size: 2_000_000 })).toBe("1.5M/2M")
    expect(usageOf({ used: 1_000_000, size: 1_000_000 })).toBe("1M/1M")
  })

  test("a context fuller than its window is drawn as it was reported", () => {
    // The surprising state is the one a person most needs to see, so nothing
    // here clamps it to a tidy 100%.
    expect(usageOf({ used: 240000, size: 200000 })).toBe("240k/200k")
  })

  test("no report is no line, which is every session before its first turn", () => {
    expect(usageOf(null)).toBeNull()
  })
})
