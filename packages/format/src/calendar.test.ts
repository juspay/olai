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

// ── the days between two days ──────────────────────────────────────────

test("a span is a subtraction, and it counts the same both ways round", () => {
  expect(daysBetween("2026-08-12", "2026-08-14")).toBe(2)
  expect(daysBetween("2026-08-14", "2026-08-12")).toBe(-2)
  expect(daysBetween("2026-08-12", "2026-08-12")).toBe(0)
})

test("a span crosses months, years and the leap rule without a table", () => {
  expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1)
  expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1)
  // 2028 is a leap year, 2100 is not, 2000 was — the Gregorian rule, all three
  // arms of it, over spans a walk of month lengths would take a thousand steps
  // to answer.
  expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2)
  expect(daysBetween("2100-02-28", "2100-03-01")).toBe(1)
  expect(daysBetween("2000-02-28", "2000-03-01")).toBe(2)
  expect(daysBetween("2026-08-12", "2027-08-12")).toBe(365)
  expect(daysBetween("2027-08-12", "2028-08-12")).toBe(366)
})

test("a span agrees with the step, which is the other way of counting one", () => {
  // Two implementations of the calendar meet here: `shiftDay` walks month
  // lengths and this subtracts serial numbers, so a disagreement between them
  // is a bug in one of them.
  for (const delta of [1, 29, 400, -1, -366]) {
    expect(daysBetween("2026-01-01", shiftDay("2026-01-01", delta))).toBe(delta)
  }
})

test("a span over text that names no day is no span at all", () => {
  // `null` rather than a zero: "these are the same day" is a different answer
  // from "one of these is not a day", and a page saying "in 0 days" about a
  // typo would be the arithmetic guessing.
  expect(daysBetween("hello", "2026-08-12")).toBeNull()
  expect(daysBetween("2026-08-12", "2026-02-30")).toBeNull()
})

// ── minutes off a moment ───────────────────────────────────────────────

// The third reading, and the first that counts something narrower than a day:
// what the query grammar's `created:1h` is a bound at.

test("minutes come off the clock face and the offset rides through", () => {
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", -60)).toBe("2026-08-13T09:30:00-04:00")
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", -30)).toBe("2026-08-13T10:00:00-04:00")
  // Forward as well as back, which is the same subtraction with a sign.
  expect(shiftMinutes("2026-08-13T10:30:00-04:00", 90)).toBe("2026-08-13T12:00:00-04:00")
  // A zone half an hour off the hour, spelled as it was written.
  expect(shiftMinutes("2026-08-13T10:30:00+05:30", -60)).toBe("2026-08-13T09:30:00+05:30")
})

test("the seconds ride through untouched, since nothing here counts them", () => {
  // A bound minted off a stamp falls a whole number of minutes before the
  // moment the question was asked, rather than at the top of a minute near it.
  expect(shiftMinutes("2026-08-01T09:12:44-04:00", -60)).toBe("2026-08-01T08:12:44-04:00")
  // ...and a datetime that wrote none gets the `:00` the shape needs.
  expect(shiftMinutes("2026-08-01T09:12-04:00", -60)).toBe("2026-08-01T08:12:00-04:00")
})

test("counting back past midnight borrows a day from the calendar", () => {
  expect(shiftMinutes("2026-08-13T00:30:00-04:00", -60)).toBe("2026-08-12T23:30:00-04:00")
  // A whole week, which is the widest unit a duration comes in.
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -7 * 24 * 60)).toBe(
    "2026-08-06T10:00:00-04:00",
  )
  // The borrow is the calendar's, so a month length and the leap rule are
  // already answered: back one minute from the 1st of March in a leap year.
  // One line, because the leap rule itself is `shiftDay`'s and is pinned above
  // — what this shows is that the borrow REACHES the calendar at all.
  expect(shiftMinutes("2028-03-01T00:00:00-04:00", -1)).toBe("2028-02-29T23:59:00-04:00")
  // ...and across a year, forwards.
  expect(shiftMinutes("2026-12-31T23:59:00-05:00", 1)).toBe("2027-01-01T00:00:00-05:00")
})

test("a clock that names only a day names the start of it", () => {
  // The reading `dayOf` makes in the other direction — ten characters are a
  // day, and a day begins at midnight. No offset comes back because none was
  // written down.
  expect(shiftMinutes("2026-08-13", -60)).toBe("2026-08-12T23:00:00")
  expect(shiftMinutes("2026-08-13", 0)).toBe("2026-08-13T00:00:00")
})

test("text that names no moment is no moment to count from", () => {
  // `null` rather than the text unchanged, which is what `shiftDay` answers
  // with: the one caller is minting a BOUND, and a bound that was quietly the
  // clock's own garbage is a query comparing against nonsense.
  expect(shiftMinutes("hello", -60)).toBeNull()
  expect(shiftMinutes("2026-02-30T10:00:00-04:00", -60)).toBeNull()
  expect(shiftMinutes("2026-08-13 10:00", -60)).toBeNull()
  expect(shiftMinutes("2026-08-13T10", -60)).toBeNull()
})

test("any number may be handed in, and the cost does not follow it", () => {
  // The delta comes from a query somebody typed, so the borrow is as wide as
  // the number. It goes through the SERIAL arithmetic rather than a walk of
  // month lengths, which is what makes this a subtraction — the assertion is
  // partly that it returns at all, since a suite that hung here would be the
  // finding.
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -Number.MAX_SAFE_INTEGER)).toBeNull()
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", Number.MAX_SAFE_INTEGER)).toBeNull()
})

test("a count that walks off the calendar has nowhere to land", () => {
  // Nineteen thousand years back is not a day four digits can spell, and the
  // arithmetic would have answered with a `-17000-12-31` — a value that is
  // neither a date nor an error. The two widest counts the grammar can hand
  // over (`999999w`, `999999d`) are both past the front of the calendar.
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -999999 * 7 * 24 * 60)).toBeNull()
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -999999 * 24 * 60)).toBeNull()
  expect(shiftMinutes("0001-01-01T00:00:00-04:00", -2 * 365 * 24 * 60)).toBeNull()
  // ...where a step that LANDS inside them is answered, however far back — the
  // question is where it lands and never how far it went.
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", -99999 * 24 * 60)).toBe(
    "1752-10-29T10:00:00-04:00",
  )
  expect(shiftMinutes("2026-08-13T10:00:00-04:00", 999999 * 24 * 60)).toBe(
    "4764-07-09T10:00:00-04:00",
  )
})

test("the step agrees with the day step, which is the other way of counting one", () => {
  // The SECOND place two implementations of this calendar meet — the pair
  // above is `daysBetween` against `shiftDay`, and this is the serial
  // arithmetic again, reached through a borrow of whole days. `shiftDay` walks
  // month lengths and this subtracts serial numbers, so a disagreement between
  // them is a bug in one of them. Both directions, and across the leap rule.
  for (const days of [0, 1, 29, 400, 1461, -1, -366, -1461]) {
    expect(shiftMinutes("2026-01-01T08:00:00-05:00", days * 24 * 60)).toBe(
      `${shiftDay("2026-01-01", days)}T08:00:00-05:00`,
    )
  }
})

// ── the names ──────────────────────────────────────────────────────────

test("the months are twelve, in the order an ISO value numbers them", () => {
  expect(MONTHS.length).toBe(12)
  expect(MONTHS[0]).toBe("January")
  expect(MONTHS[Number("2026-08-12".slice(5, 7)) - 1]).toBe("August")
  expect(MONTHS.at(-1)).toBe("December")
})
