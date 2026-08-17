import { expect, test } from "bun:test"

import {
  daysOf,
  isMonth,
  isoDate,
  isRealDay,
  monthOfDay,
  shiftDay,
  shiftDayByMonth,
  shiftMonth,
  weekdayOf,
} from "./calendar.ts"

// The arithmetic every other date reading in this codebase is spared, tested
// where it lives. It came down from the browser's calendar grid when the query
// grammar's relative words needed the same two questions; these assertions came
// with it, plus the ones a week span asks.

// ── what a month holds ─────────────────────────────────────────────────

test("a month runs from its 1st to its last day", () => {
  expect(daysOf("2026-08")[0]).toBe("2026-08-01")
  expect(daysOf("2026-08").at(-1)).toBe("2026-08-31")
  expect(daysOf("2026-08").length).toBe(31)
  expect(daysOf("2026-04").length).toBe(30)
})

// The Gregorian rule, all three clauses: 2028 is a leap year, 2026 is not,
// 2100 is not (a hundredth), 2000 was (a four-hundredth).
test("February is as long as the leap rule says", () => {
  expect(daysOf("2026-02").length).toBe(28)
  expect(daysOf("2028-02").length).toBe(29)
  expect(daysOf("2100-02").length).toBe(28)
  expect(daysOf("2000-02").length).toBe(29)
})

test("text that names no month holds no days", () => {
  expect(daysOf("hello")).toEqual([])
  expect(daysOf("")).toEqual([])
  expect(daysOf("2026-13")).toEqual([])
  expect(isMonth("2026-08")).toBe(true)
  expect(isMonth("2026-13")).toBe(false)
  expect(isMonth("2026-8")).toBe(false)
})

test("date text is minted from parts, zero-padded", () => {
  expect(isoDate(2026, 8, 1)).toBe("2026-08-01")
  expect(isoDate(2026, 12, 31)).toBe("2026-12-31")
})

// THE YEAR TOO, which is not pedantry about the first millennium: every reader
// of this text is a four-digit regex, this module's own parsers included. A
// step off the front of the year 1000 used to mint `999-12-31` — a value that
// is neither a date nor an error, and one that comes back out of `shiftDay`
// and straight into a `date:` bound.
test("a year is four characters wherever this mints one", () => {
  expect(isoDate(999, 12, 31)).toBe("0999-12-31")
  expect(shiftDay("1000-01-01", -1)).toBe("0999-12-31")
  expect(shiftMonth("1000-01", -1)).toBe("0999-12")
  // …and what it mints, it can read back. That is the property the padding is
  // for: nothing here answers with text its own parser refuses.
  expect(isRealDay(shiftDay("1000-01-01", -1))).toBe(true)
  expect(isMonth(shiftMonth("1000-01", -1))).toBe(true)
  expect(daysOf(shiftMonth("1000-01", -1)).length).toBe(31)
})

// ── paging ─────────────────────────────────────────────────────────────

test("paging crosses a year end without a special case", () => {
  expect(shiftMonth("2026-08", 1)).toBe("2026-09")
  expect(shiftMonth("2026-12", 1)).toBe("2027-01")
  expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  expect(shiftMonth("2026-08", -8)).toBe("2025-12")
  expect(shiftMonth("2026-08", 0)).toBe("2026-08")
})

test("paging is reversible", () => {
  for (const month of ["2026-01", "2026-08", "2026-12"]) {
    expect(shiftMonth(shiftMonth(month, 1), -1)).toBe(month)
  }
})

// `/d/<anything>` is an address a person can type, and its month is whatever
// the first seven characters were.
test("a day names its month, and text that is not one names none", () => {
  expect(monthOfDay("2026-08-10")).toBe("2026-08")
  expect(monthOfDay("2026-08-10T14:30")).toBe("2026-08")
  expect(monthOfDay("2026-08")).toBe("2026-08")
  expect(monthOfDay("2026-13-01")).toBeNull()
  expect(monthOfDay("2026-00-01")).toBeNull()
  expect(monthOfDay("2026-8-1")).toBeNull()
  expect(monthOfDay("hello")).toBeNull()
  expect(monthOfDay(undefined)).toBeNull()
})

// ── one day at a time ──────────────────────────────────────────────────

test("a day is real when its month has one", () => {
  expect(isRealDay("2026-08-31")).toBe(true)
  expect(isRealDay("2026-02-29")).toBe(false)
  expect(isRealDay("2028-02-29")).toBe(true)
  expect(isRealDay("2026-13-01")).toBe(false)
  expect(isRealDay("2026-08-1")).toBe(false)
  expect(isRealDay("tomorrow")).toBe(false)
})

test("which weekday a day falls on, counted from Monday", () => {
  expect(weekdayOf("2026-08-14")).toBe(4) // a Friday
  expect(weekdayOf("2026-08-17")).toBe(0) // the Monday after
  expect(weekdayOf("2026-08-23")).toBe(6) // and the Sunday that ends that week
  expect(weekdayOf("nonsense")).toBeNull()
})

test("shifting a day crosses months and years", () => {
  expect(shiftDay("2026-08-14", 1)).toBe("2026-08-15")
  expect(shiftDay("2026-08-31", 1)).toBe("2026-09-01")
  expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01")
  expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31")
  expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28")
  expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29")
  expect(shiftDay("2026-08-14", 0)).toBe("2026-08-14")
  expect(shiftDay("2026-01-01", 400)).toBe("2027-02-05")
})

test("shifting text that names no day gives it back unchanged", () => {
  // The rule `shiftMonth` already follows: looking around is never a way to end
  // up somewhere that is not a date.
  expect(shiftDay("hello", 1)).toBe("hello")
  expect(shiftDayByMonth("hello", 1)).toBe("hello")
})

test("a month step keeps the day, or the last one the month has", () => {
  expect(shiftDayByMonth("2026-08-14", 1)).toBe("2026-09-14")
  expect(shiftDayByMonth("2026-01-31", 1)).toBe("2026-02-28")
  expect(shiftDayByMonth("2026-12-15", 1)).toBe("2027-01-15")
  expect(shiftDayByMonth("2026-01-15", -1)).toBe("2025-12-15")
})
