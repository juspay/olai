import { expect, test } from "bun:test"

import {
  isRepeat,
  nextAfter,
  nextOccurrence,
  parseRepeat,
  printRepeat,
  type Repeat,
  REPEAT_RULES,
  WEEKDAYS,
} from "./repeat.ts"

// The grammar, and the arithmetic it names. Two properties carry most of this
// file: whatever `parseRepeat` reads, `printRepeat` writes back as the same
// rule — and every rule the picker offers is a rule the format takes.

// ── the round trip ─────────────────────────────────────────────────────

test("every canonical spelling parses back to the rule it prints", () => {
  for (const text of REPEAT_RULES) {
    const rule = parseRepeat(text)
    expect(rule).toBeDefined()
    expect(printRepeat(rule as Repeat)).toBe(text)
  }
})

test("the grammar is ten rules and no eleventh", () => {
  // A day, a month, a year, and one per weekday. Written out so a rule added
  // to the vocabulary is a decision somebody makes here rather than a list
  // that quietly grew.
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

test("a rule taken apart and put back together is the text it came from", () => {
  expect(printRepeat({ every: "day" })).toBe("every day")
  expect(printRepeat({ every: "month" })).toBe("every month")
  expect(printRepeat({ every: "year" })).toBe("every year")
  expect(printRepeat({ every: "week", weekday: 0 })).toBe("every week on monday")
  expect(printRepeat({ every: "week", weekday: 6 })).toBe("every week on sunday")
})

// ── what it forgives, and what it will not ─────────────────────────────

test("case and spacing are a person typing, not a second grammar", () => {
  expect(parseRepeat("Every Week On Monday")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("  every   day  ")).toEqual({ every: "day" })
})

test("`mon` is monday, and `every monday` is the same rule said shorter", () => {
  expect(parseRepeat("every week on mon")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("every monday")).toEqual({ every: "week", weekday: 0 })
  expect(parseRepeat("every sun")).toEqual({ every: "week", weekday: 6 })
})

// The whole point of a small grammar is that the things it does NOT say are
// unsayable rather than half-understood: an interval, a count, an end date, a
// second weekday, a cron field.
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
    expect(isRepeat(text)).toBe(false)
  }
})

// A bare index into an object literal answers `every constructor` with a
// function off the prototype, and a cast would wave it straight through.
test("a word that names a prototype member is not a rule", () => {
  expect(parseRepeat("every constructor")).toBeUndefined()
  expect(parseRepeat("every toString")).toBeUndefined()
})

// ── when the next one is ───────────────────────────────────────────────

test("every day is the day after", () => {
  expect(nextAfter({ every: "day" }, "2026-08-17")).toBe("2026-08-18")
  expect(nextAfter({ every: "day" }, "2026-08-31")).toBe("2026-09-01")
  expect(nextAfter({ every: "day" }, "2026-12-31")).toBe("2027-01-01")
})

// STRICTLY after: a weekly rule completed on its own weekday is next week's,
// never the same day back again — which would be a task that spawns itself.
test("every week on a weekday is the NEXT one, never the same day", () => {
  // 2026-08-17 is a Monday.
  expect(WEEKDAYS[0]).toBe("monday")
  expect(nextAfter({ every: "week", weekday: 0 }, "2026-08-17")).toBe("2026-08-24")
  // From a Tuesday, the coming Monday is six days on.
  expect(nextAfter({ every: "week", weekday: 0 }, "2026-08-18")).toBe("2026-08-24")
  // …and the coming Wednesday is tomorrow.
  expect(nextAfter({ every: "week", weekday: 2 }, "2026-08-18")).toBe("2026-08-19")
})

test("every month keeps the day of the month, clamped to one that exists", () => {
  expect(nextAfter({ every: "month" }, "2026-08-17")).toBe("2026-09-17")
  expect(nextAfter({ every: "month" }, "2026-12-31")).toBe("2027-01-31")
  // The 31st of January has no answer in February, and refusing to answer
  // would be worse than the end of the month.
  expect(nextAfter({ every: "month" }, "2026-01-31")).toBe("2026-02-28")
})

test("every year is twelve months on, and February the 29th clamps", () => {
  expect(nextAfter({ every: "year" }, "2026-08-17")).toBe("2027-08-17")
  expect(nextAfter({ every: "year" }, "2028-02-29")).toBe("2029-02-28")
})

// The rhythm is the FILE's and never the clock's: one period on from the
// node's own date, whatever day it is when somebody ticks it off. A rule that
// caught up to today would need a clock inside a derivation and a second
// modifier in the grammar to choose between the two readings.
test("the next one is one period after the node's own date, however late", () => {
  expect(nextAfter({ every: "day" }, "2020-01-01")).toBe("2020-01-02")
})

test("a datetime counts for its day, and the time is not carried forward", () => {
  expect(nextAfter({ every: "day" }, "2026-08-17T14:30:00-04:00")).toBe("2026-08-18")
})

// ./calendar.ts's own rule for text it cannot count with, read once more:
// shifting is a way to look around, never a way to end up somewhere that is
// not a day.
test("text that names no day comes back as the day it was given", () => {
  expect(nextAfter({ every: "day" }, "2026-02-30")).toBe("2026-02-30")
  expect(nextAfter({ every: "month" }, "not a date")).toBe("not a date")
})

// ── the two halves in one call ─────────────────────────────────────────

test("nextOccurrence reads the rule and counts in one call", () => {
  expect(nextOccurrence("every week on monday", "2026-08-17")).toBe("2026-08-24")
  expect(nextOccurrence("EVERY MONTH", "2026-08-17")).toBe("2026-09-17")
})

test("nextOccurrence answers nothing for text that is not a rule", () => {
  expect(nextOccurrence("every 2 weeks", "2026-08-17")).toBeUndefined()
})
