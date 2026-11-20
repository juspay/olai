import { describe, expect, test } from "bun:test"

import { whenOf } from "./when.ts"

const iso = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string => new Date(year, month - 1, day, hour, minute).toISOString()

describe("when a conversation was last touched", () => {
  test("is the reader's own day and minute", () => {
    expect(whenOf(iso(2026, 8, 1, 17, 30))).toBe("2026-08-01 17:30")
  })

  test("pads, so the column lines up", () => {
    expect(whenOf(iso(2026, 1, 2, 3, 4))).toBe("2026-01-02 03:04")
  })

  test("tells two conversations of the same day apart", () => {
    expect(whenOf(iso(2026, 8, 1, 17, 30))).not.toBe(whenOf(iso(2026, 8, 1, 17, 31)))
  })

  test("says nothing about a value that is not a time", () => {
    expect(whenOf("whenever")).toBe(null)
    expect(whenOf("")).toBe(null)
  })

  test("says nothing about a session the agent never stamped", () => {
    expect(whenOf(null)).toBe(null)
  })
})
