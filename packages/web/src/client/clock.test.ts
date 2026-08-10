import { expect, test } from "bun:test"

import { isoDayOf, untilMidnight } from "./clock.ts"

/** An instant built from LOCAL parts, which is what these two functions read.
 *  A UTC literal would make the suite pass or fail by the runner's time zone,
 *  which is the very confusion this module exists to keep out of the app. */
const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date => new Date(year, month - 1, day, hour, minute)

// Local, and zero-padded: the day a person wrote in a file is the day where
// they are, and `toISOString` would put a reader west of Greenwich on
// tomorrow's date all evening.
test("today is the local calendar day, as ISO text", () => {
  expect(isoDayOf(at(2026, 8, 9, 23, 59))).toBe("2026-08-09")
  expect(isoDayOf(at(2026, 8, 10, 0, 0))).toBe("2026-08-10")
  expect(isoDayOf(at(2026, 1, 5, 12, 0))).toBe("2026-01-05")
})

test("the wait is until the next local midnight, and lands past it", () => {
  const noon = at(2026, 8, 9, 12)
  expect(untilMidnight(noon)).toBe(12 * 60 * 60 * 1000 + 1)
  // Exactly midnight is a whole day's wait, not none: the day it is has just
  // been read, and the next one is 24 hours off.
  expect(untilMidnight(at(2026, 8, 9))).toBe(24 * 60 * 60 * 1000 + 1)
})

// The wait always crosses into a new day — never zero, never the same day
// back — which is what stops a timer that fires a hair early from spinning.
test("waiting that long always lands on the next day", () => {
  for (const hour of [0, 1, 12, 22, 23]) {
    const now = at(2026, 2, 28, hour, 30)
    const woken = new Date(now.getTime() + untilMidnight(now))
    expect(untilMidnight(now)).toBeGreaterThan(0)
    expect(isoDayOf(woken)).toBe("2026-03-01")
  }
})
