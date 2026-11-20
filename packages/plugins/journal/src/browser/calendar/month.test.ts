import { expect, test } from "bun:test"

import { dayNumber, monthGrid, monthLabel, shortDay, WEEKDAY_HEADINGS } from "./month.ts"

const days = (month: string): ReadonlyArray<string> =>
  monthGrid(month).filter((cell): cell is string => cell !== null)

const lead = (month: string): number =>
  monthGrid(month).findIndex((cell) => cell !== null)

test("a month is laid out as whole weeks", () => {
  for (const month of ["2026-01", "2026-02", "2026-08", "2027-02", "2028-02"]) {
    expect(monthGrid(month).length % WEEKDAY_HEADINGS.length).toBe(0)
  }
})

test("the 1st lands in the column its weekday names", () => {
  expect(lead("2026-08")).toBe(5)
  expect(lead("2026-06")).toBe(0)
  expect(lead("2026-03")).toBe(6)
})

test("a month runs from its 1st to its last day", () => {
  expect(days("2026-08")[0]).toBe("2026-08-01")
  expect(days("2026-08").at(-1)).toBe("2026-08-31")
  expect(days("2026-08").length).toBe(31)
})

test("every cell that is not padding is a day of this month", () => {
  for (const day of days("2026-08")) expect(day.startsWith("2026-08-")).toBe(true)
})

test("text that names no month draws no grid", () => {
  expect(monthGrid("hello")).toEqual([])
  expect(monthGrid("")).toEqual([])
  expect(monthGrid("2026-13")).toEqual([])
  expect(monthLabel("")).toBe("")
})

test("a heading is printed for each column of the week", () => {
  expect(WEEKDAY_HEADINGS.length).toBe(7)
  expect(WEEKDAY_HEADINGS[0]).toBe("Mo")
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

test("the Today row's date is the month's three letters and the day", () => {
  expect(shortDay("2026-09-28")).toBe("Sep 28")
  expect(shortDay("2026-01-05")).toBe("Jan 5")
  expect(shortDay("2026-12-31")).toBe("Dec 31")
  expect(shortDay("")).toBe("")
  expect(shortDay("2026-13-01")).toBe("2026-13-01")
})
