import { expect, test } from "bun:test"

import {
  canonicalRepeat,
  nextAfter,
  nextOccurrence,
  parseRepeat,
  printRepeat,
  type Repeat,
  REPEAT_RULES,
} from "./repeat.ts"
import { WEEKDAYS } from "./calendar.ts"

test("every canonical spelling parses back to the rule it prints", () => {
  for (const text of REPEAT_RULES) {
    const rule = parseRepeat(text)
    expect(rule).toBeDefined()
    expect(printRepeat(rule as Repeat)).toBe(text)
  }
})

test("the grammar is ten rules and no eleventh", () => {
  expect(REPEAT_RULES).toEqual([
    "every day",
    "every week on monday",
    "every week on tuesday",
    "every week on wednesday",
    "every week on thursday",
    "every week on friday",
    "every week on saturday",
    "every week on sunday",
    "every month",
    "every year",
  ])
})

test("canonicalRepeat is the spelling a write stores", () => {
  expect(canonicalRepeat("every monday")).toBe("every week on monday")
  expect(canonicalRepeat("every week on MON")).toBe("every week on monday")
  expect(canonicalRepeat("  Every   Day  ")).toBe("every day")
  for (const rule of REPEAT_RULES) expect(canonicalRepeat(rule)).toBe(rule)
})

test("a rule taken apart and put back together is the text it came from", () => {
  expect(printRepeat({ every: "day" })).toBe("every day")
  expect(printRepeat({ every: "month" })).toBe("every month")
  expect(printRepeat({ every: "year" })).toBe("every year")
  expect(printRepeat({ every: "week", weekday: 0 })).toBe("every week on monday")
  expect(printRepeat({ every: "week", weekday: 6 })).toBe("every week on sunday")
})

test("case and spacing are a person typing, not a second grammar", () => {
  expect(parseRepeat("Every Week On Monday")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("  every   day  ")).toEqual({ every: "day" })
})

test("`mon` is monday, and `every monday` is the same rule said shorter", () => {
  expect(parseRepeat("every week on mon")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("every monday")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("every sun")).toEqual({ every: "week", weekday: 6 })
})

test("what is not in the vocabulary is not guessed at", () => {
  for (const text of [
    "every 2 weeks",
    "every week",
    "every week monday",
    "every other day",
    "every day until 2026-12-01",
    "every month on the 3rd",
    "every week on monday and thursday",
    "0 0 * * 1",
    "daily",
    "",
    "every",
    "every m",
  ]) {
    expect(parseRepeat(text)).toBeUndefined()
    expect(canonicalRepeat(text)).toBeUndefined()
  }
})

test("a word that names a prototype member is not a rule", () => {
  expect(parseRepeat("every constructor")).toBeUndefined()
  expect(parseRepeat("every toString")).toBeUndefined()
})

test("every day is the day after", () => {
  expect(nextAfter({ every: "day" }, "2026-08-17")).toBe("2026-08-18")
  expect(nextAfter({ every: "day" }, "2026-08-31")).toBe("2026-09-01")
  expect(nextAfter({ every: "day" }, "2026-12-31")).toBe("2027-01-01")
})

test("every week on a weekday is the NEXT one, never the same day", () => {
  expect(WEEKDAYS[0]).toBe("monday")
  expect(nextAfter({ every: "week", weekday: 0 }, "2026-08-17")).toBe("2026-08-24")
  expect(nextAfter({ every: "week", weekday: 0 }, "2026-08-18")).toBe("2026-08-24")
  expect(nextAfter({ every: "week", weekday: 2 }, "2026-08-18")).toBe("2026-08-19")
})

test("every month keeps the day of the month, clamped to one that exists", () => {
  expect(nextAfter({ every: "month" }, "2026-08-17")).toBe("2026-09-17")
  expect(nextAfter({ every: "month" }, "2026-12-31")).toBe("2027-01-31")
  expect(nextAfter({ every: "month" }, "2026-01-31")).toBe("2026-02-28")
})

test("every year is twelve months on, and February the 29th clamps", () => {
  expect(nextAfter({ every: "year" }, "2026-08-17")).toBe("2027-08-17")
  expect(nextAfter({ every: "year" }, "2028-02-29")).toBe("2029-02-28")
})

test("the next one is one period after the node's own date, however late", () => {
  expect(nextAfter({ every: "day" }, "2020-01-01")).toBe("2020-01-02")
})

test("a datetime counts for its day, and the time is not carried forward", () => {
  expect(nextAfter({ every: "day" }, "2026-08-17T14:30:00-04:00")).toBe("2026-08-18")
})

test("text that names no day comes back as the day it was given", () => {
  expect(nextAfter({ every: "day" }, "2026-02-30")).toBe("2026-02-30")
  expect(nextAfter({ every: "month" }, "not a date")).toBe("not a date")
})

test("nextOccurrence reads the rule and counts in one call", () => {
  expect(nextOccurrence("every week on monday", "2026-08-17")).toBe("2026-08-24")
  expect(nextOccurrence("EVERY MONTH", "2026-08-17")).toBe("2026-09-17")
})

test("nextOccurrence answers nothing for text that is not a rule", () => {
  expect(nextOccurrence("every 2 weeks", "2026-08-17")).toBeUndefined()
})
