import { expect, test } from "bun:test"

import { dayNumber, isMonth, monthGrid, monthLabel, shiftMonth, WEEKDAYS } from "./month.ts"

/** The grid's days, with the padding dropped — what the month actually holds. */
const days = (month: string): ReadonlyArray<string> =>
  monthGrid(month).filter((cell): cell is string => cell !== null)

/** How many blank cells the grid opens with: which column the 1st lands in. */
const lead = (month: string): number =>
  monthGrid(month).findIndex((cell) => cell !== null)

// ── the shape of the grid ──────────────────────────────────────────────

// Whole weeks, both ends padded — so the columns line up under their headings
// however the month falls.
test("a month is laid out as whole weeks", () => {
  for (const month of ["2026-01", "2026-02", "2026-08", "2027-02", "2028-02"]) {
    expect(monthGrid(month).length % WEEKDAYS.length).toBe(0)
  }
})

// The week starts on Monday, so a month starting on a Saturday opens with five
// blanks and a month starting on a Monday with none. Both are real: 1 August
// 2026 is a Saturday, 1 June 2026 a Monday.
test("the 1st lands in the column its weekday names", () => {
  expect(lead("2026-08")).toBe(5)
  expect(lead("2026-06")).toBe(0)
  // A Sunday is the LAST column, not the first: 1 March 2026 is a Sunday.
  expect(lead("2026-03")).toBe(6)
})

test("a month runs from its 1st to its last day", () => {
  expect(days("2026-08")[0]).toBe("2026-08-01")
  expect(days("2026-08").at(-1)).toBe("2026-08-31")
  expect(days("2026-08").length).toBe(31)
  expect(days("2026-04").length).toBe(30)
})

// The Gregorian rule, all three clauses: 2028 is a leap year, 2026 is not,
// 2100 is not (a hundredth), 2000 was (a four-hundredth).
test("February is as long as the leap rule says", () => {
  expect(days("2026-02").length).toBe(28)
  expect(days("2028-02").length).toBe(29)
  expect(days("2100-02").length).toBe(28)
  expect(days("2000-02").length).toBe(29)
})

// A day of a month is that month's, and no cell of the grid belongs to
// another: the padding is `null` rather than a neighbouring date, so a dot can
// never be drawn on a day the reader is not looking at.
test("every cell that is not padding is a day of this month", () => {
  for (const day of days("2026-08")) expect(day.startsWith("2026-08-")).toBe(true)
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

// ── text this file did not mint ────────────────────────────────────────

// `/d/<anything>` is an address a person can type, and its month is whatever
// the first seven characters were. A grid is not the place to explain that:
// it draws nothing, and the day view says what is wrong.
test("text that is not a month is not one", () => {
  expect(isMonth("2026-08")).toBe(true)
  expect(isMonth("2026-13")).toBe(false)
  expect(isMonth("2026-00")).toBe(false)
  expect(isMonth("hello")).toBe(false)
  expect(isMonth("2026-8")).toBe(false)
  expect(monthGrid("hello")).toEqual([])
  expect(shiftMonth("hello", 1)).toBe("hello")
})

// ── what a cell prints ─────────────────────────────────────────────────

test("a heading is printed for each column of the week", () => {
  expect(WEEKDAYS.length).toBe(7)
  expect(WEEKDAYS[0]).toBe("Mo")
})

test("a cell prints the day of the month, unpadded", () => {
  expect(dayNumber("2026-08-01")).toBe("1")
  expect(dayNumber("2026-08-31")).toBe("31")
})

test("the heading over a month names it in words", () => {
  expect(monthLabel("2026-08")).toBe("August 2026")
  expect(monthLabel("2026-01")).toBe("January 2026")
  expect(monthLabel("2026-12")).toBe("December 2026")
  expect(monthLabel("hello")).toBe("hello")
})
