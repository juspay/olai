import { expect, test } from "bun:test"

import { DATE_SHAPE, endsAt, iso } from "./date.ts"

// THE CALENDAR, month by month: a 31st is a day in March and not in April, a
// 29th is a day in a leap year and not in another, and December is not a month
// without an end. (from `hledger.test.ts`'s "a day is judged against the month
// it names")
test("a day is judged against the month it names", () => {
  for (const day of ["2024-03-31", "2024-12-31", "2024-01-31", "2024-02-29", "2023-02-28"]) {
    expect(iso(day), day).toBe(day)
  }
  for (const day of [
    "2024-04-31",
    "2024-06-31",
    "2024-09-31",
    "2024-11-31",
    "2024-02-30",
    "2023-02-29",
    "2024-12-32",
    "2024-02-31",
    "2024-00-10",
    "2024-13-01",
  ]) {
    expect(iso(day), day).toBeNull()
  }
})

// The three separators hledger accepts are all one reading, and the month and
// day are normalized to two digits.
test("every separator hledger writes is one day", () => {
  expect(iso("2026/1/5")).toBe("2026-01-05")
  expect(iso("2026.2.28")).toBe("2026-02-28")
  expect(iso("2026-1-5")).toBe("2026-01-05")
  expect(iso("2026-01-05")).toBe("2026-01-05")
  expect(iso("not a day")).toBeNull()
})

// A DATE ENDS WHERE THE REST OF THE HEADER BEGINS: `2024-01-01x` is not a date
// with a description.
test("a date must stand alone at the head of a line", () => {
  expect(DATE_SHAPE.test("2024-01-01 x")).toBe(true)
  expect(DATE_SHAPE.test("2024-01-01x y")).toBe(true)
  expect(endsAt("2024-01-01x y", "2024-01-01".length)).toBe(false)
  expect(endsAt("2024-01-01 x", "2024-01-01".length)).toBe(true)
  expect(endsAt("2024-01-01", "2024-01-01".length)).toBe(true)
})
