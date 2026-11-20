import { expect, test } from "bun:test"

import {
  daysBetween,
  daysOf,
  isMonth,
  isoDate,
  isRealDay,
  monthOfDay,
  MONTHS,
  shiftDay,
  shiftDayByMonth,
  shiftMinutes,
  shiftMonth,
  weekdayOf,
} from "./calendar.ts"

test("a month runs from its 1st to its last day", () => {
  expect(daysOf("2026-08")[0]).toBe("2026-08-01")
  expect(daysOf("2026-08").at(-1)).toBe("2026-08-31")
  expect(daysOf("2026-08").length).toBe(31)
  expect(daysOf("2026-04").length).toBe(30)
})

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

test("a year is four characters wherever this mints one", () => {
  expect(isoDate(999, 12, 31)).toBe("0999-12-31")
  expect(shiftDay("1000-01-01", -1)).toBe("0999-12-31")
  expect(shiftMonth("1000-01", -1)).toBe("0999-12")
  expect(isRealDay(shiftDay("1000-01-01", -1))).toBe(true)
  expect(isMonth(shiftMonth("1000-01", -1))).toBe(true)
  expect(daysOf(shiftMonth("1000-01", -1)).length).toBe(31)
})

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

test("a day is real when its month has one", () => {
  expect(isRealDay("2026-08-31")).toBe(true)
  expect(isRealDay("2026-02-29")).toBe(false)
  expect(isRealDay("2028-02-29")).toBe(true)
  expect(isRealDay("2026-13-01")).toBe(false)
  expect(isRealDay("2026-08-1")).toBe(false)
  expect(isRealDay("tomorrow")).toBe(false)
})

test("which weekday a day falls on, counted from Monday", () => {
  expect(weekdayOf("2026-08-14")).toBe(4)
  expect(weekdayOf("2026-08-17")).toBe(0)
  expect(weekdayOf("2026-08-23")).toBe(6)
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
  expect(shiftDay("hello", 1)).toBe("hello")
  expect(shiftDayByMonth("hello", 1)).toBe("hello")
})

test("a month step keeps the day, or the last one the month has", () => {
  expect(shiftDayByMonth("2026-08-14", 1)).toBe("2026-09-14")
  expect(shiftDayByMonth("2026-01-31", 1)).toBe("2026-02-28")
  expect(shiftDayByMonth("2026-12-15", 1)).toBe("2027-01-15")
  expect(shiftDayByMonth("2026-01-15", -1)).toBe("2025-12-15")
})

test("a span is a subtraction, and it counts the same both ways round", () => {
  expect(daysBetween("2026-08-12", "2026-08-14")).toBe(2)
  expect(daysBetween("2026-08-14", "2026-08-12")).toBe(-2)
  expect(daysBetween("2026-08-12", "2026-08-12")).toBe(0)
})

test("a span crosses months, years and the leap rule without a table", () => {
  expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1)
  expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1)
  expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2)
  expect(daysBetween("2100-02-28", "2100-03-01")).toBe(1)
  expect(daysBetween("2000-02-28", "2000-03-01")).toBe(2)
  expect(daysBetween("2026-08-12", "2027-08-12")).toBe(365)
  expect(daysBetween("2027-08-12", "2028-08-12")).toBe(366)
})

test("a span agrees with the step, which is the other way of counting one", () => {
  for (const delta of [1, 29, 400, -1, -366]) {
    expect(daysBetween("2026-01-01", shiftDay("2026-01-01", delta))).toBe(delta)
  }
})

test("a span over text that names no day is no span at all", () => {
  expect(daysBetween("hello", "2026-08-12")).toBeNull()
  expect(daysBetween("2026-08-12", "2026-02-30")).toBeNull()
})

test("minutes come off the clock face and the offset rides through", () => {
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", -60)).toBe("2026-08-13T09:30:00-04:00")
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", -30)).toBe("2026-08-13T10:00:00-04:00")
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", 90)).toBe("2026-08-13T12:00:00-04:00")
  expect(shiftMinutes("2026-08-13T10:30:00+05:30", -60)).toBe("2026-08-13T09:30:00+05:30")
})

test("the seconds ride through untouched, since nothing here counts them", () => {
  expect(shiftMinutes("2026-08-01T09:12:44-04:00", -60)).toBe("2026-08-01T08:12:44-04:00")
  expect(shiftMinutes("2026-08-01T09:12-04:00", -60)).toBe("2026-08-01T08:12:00-04:00")
})

test("counting back past midnight borrows a day from the calendar", () => {
  expect(shiftMinutes("2026-08-13T00:30:00-04:00", -60)).toBe("2026-08-12T23:30:00-04:00")
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -7 * 24 * 60)).toBe(
    "2026-08-06T10:00:00-04:00",
  )
  expect(shiftMinutes("2028-03-01T00:00:00-04:00", -1)).toBe("2028-02-29T23:59:00-04:00")
  expect(shiftMinutes("2026-12-31T23:59:00-05:00", 1)).toBe("2027-01-01T00:00:00-05:00")
})

test("a clock that names only a day names the start of it", () => {
  expect(shiftMinutes("2026-08-13", -60)).toBe("2026-08-12T23:00:00")
  expect(shiftMinutes("2026-08-13", 0)).toBe("2026-08-13T00:00:00")
})

test("text that names no moment is no moment to count from", () => {
  expect(shiftMinutes("hello", -60)).toBeNull()
  expect(shiftMinutes("2026-02-30T10:00:00-04:00", -60)).toBeNull()
  expect(shiftMinutes("2026-08-13 10:00", -60)).toBeNull()
  expect(shiftMinutes("2026-08-13T10", -60)).toBeNull()
})

test("any number may be handed in, and the cost does not follow it", () => {
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -Number.MAX_SAFE_INTEGER)).toBeNull()
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", Number.MAX_SAFE_INTEGER)).toBeNull()
})

test("a count that walks off the calendar has nowhere to land", () => {
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -999999 * 7 * 24 * 60)).toBeNull()
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -999999 * 24 * 60)).toBeNull()
  expect(shiftMinutes("0001-01-01T00:00:00-04:00", -2 * 365 * 24 * 60)).toBeNull()
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -99999 * 24 * 60)).toBe(
    "1752-10-29T10:00:00-04:00",
  )
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", 999999 * 24 * 60)).toBe(
    "4764-07-09T10:00:00-04:00",
  )
})

test("the serial arithmetic agrees with the walk, over a decade of days", () => {
  const deltas = [0, 1, -1, 27, -27, 365, -365, 1461, -1461, 40000, -40000]
  let checked = 0
  for (let step = 0; step < 3700; step += 7) {
    const base = shiftDay("2020-01-01", step)
    for (const delta of deltas) {
      expect(shiftMinutes(`${base}T08:30:00-04:00`, delta * 24 * 60)).toBe(
        `${shiftDay(base, delta)}T08:30:00-04:00`,
      )
      checked++
    }
  }
  expect(checked).toBe(529 * deltas.length)
})

test("the step agrees with the day step, which is the other way of counting one", () => {
  for (const days of [0, 1, 29, 400, 1461, -1, -366, -1461]) {
    expect(shiftMinutes("2026-01-01T08:00:00-05:00", days * 24 * 60)).toBe(
      `${shiftDay("2026-01-01", days)}T08:00:00-05:00`,
    )
  }
})

test("the months are twelve, in the order an ISO value numbers them", () => {
  expect(MONTHS.length).toBe(12)
  expect(MONTHS[0]).toBe("January")
  expect(MONTHS[Number("2026-08-12".slice(5, 7)) - 1]).toBe("August")
  expect(MONTHS.at(-1)).toBe("December")
})
