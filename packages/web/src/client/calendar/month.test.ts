import { expect, test } from "bun:test"

import { dayNumber, monthGrid, monthLabel, WEEKDAYS } from "./month.ts"

// The arithmetic these are drawn from is tested where it now lives
// (`@olai/format`'s `calendar.test.ts`) — what is left here is the grid.

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
  expect(days("2026-02").length).toBe(28)
  expect(days("2028-02").length).toBe(29)
})

// A day of a month is that month's, and no cell of the grid belongs to
// another: the padding is `null` rather than a neighbouring date, so a dot can
// never be drawn on a day the reader is not looking at.
test("every cell that is not padding is a day of this month", () => {
  for (const day of days("2026-08")) expect(day.startsWith("2026-08-")).toBe(true)
})

// ── text this file did not mint ────────────────────────────────────────

test("text that names no month draws no grid", () => {
  expect(monthGrid("hello")).toEqual([])
  expect(monthGrid("")).toEqual([])
  expect(monthGrid("2026-13")).toEqual([])
  expect(monthLabel("")).toBe("")
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
