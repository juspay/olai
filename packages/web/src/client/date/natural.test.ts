/**
 * The days a person can name in words.
 *
 * Every phrase here is right for most of the year and wrong for one particular
 * week, which is exactly why this is a unit test and not a scenario: the
 * interesting cases are "typed on a Friday", "typed in December", "typed on the
 * 31st", and none of them is reachable from a browser without waiting.
 *
 * `2026-08-14` is a FRIDAY, and most of these are anchored on it.
 */

import { expect, test } from "bun:test"

import { dayLabel, naturalDays } from "./natural.ts"

const FRIDAY = "2026-08-14"

/** The phrase → day pairs an answer is, flattened for readable assertions. */
const days = (query: string, today = FRIDAY): ReadonlyArray<string> =>
  naturalDays(query, today).map((named) => `${named.phrase} = ${named.day}`)

// ── the bare `!` ───────────────────────────────────────────────────────

test("a bare `!` offers the three a person reaches for without typing", () => {
  expect(days("")).toEqual([
    "today = 2026-08-14",
    "tomorrow = 2026-08-15",
    "next week = 2026-08-21",
  ])
})

// ── the vocabulary, matched by prefix ──────────────────────────────────

test("a prefix is the whole of what an abbreviation is", () => {
  // No rule about abbreviations anywhere: `tom` is a shorter `tomorrow`.
  expect(days("tom")).toEqual(["tomorrow = 2026-08-15"])
  // ...and a shorter prefix is simply a longer list, in the order the phrases
  // are declared: the near ones first, then the weekdays.
  expect(days("t")).toEqual([
    "today = 2026-08-14",
    "tomorrow = 2026-08-15",
    "tuesday = 2026-08-18",
    "thursday = 2026-08-20",
  ])
})

test("a bare weekday is the COMING one, strictly after today", () => {
  expect(days("mon")).toEqual(["monday = 2026-08-17"])
})

test("the same weekday as today is a week away, not today", () => {
  // Typed on a Friday. Somebody who meant today has a shorter word for it.
  expect(days("friday")).toEqual(["friday = 2026-08-21"])
})

test("`next <weekday>` is the week after the coming one", () => {
  expect(days("next fri")).toEqual(["next friday = 2026-08-28"])
})

test("next week and next month are the two coarse steps", () => {
  expect(days("next w")).toEqual([
    "next week = 2026-08-21",
    "next wednesday = 2026-08-26",
  ])
  expect(days("next mo")).toEqual([
    "next month = 2026-09-14",
    "next monday = 2026-08-24",
  ])
})

test("next month from the 31st lands on the last day it can", () => {
  expect(days("next month", "2026-01-31")).toEqual(["next month = 2026-02-28"])
})

test("yesterday is offered too — a date can be recorded as well as planned", () => {
  expect(days("yest")).toEqual(["yesterday = 2026-08-13"])
})

// ── the counted forms ──────────────────────────────────────────────────

test("`in N days / weeks / months`, singular and plural, long and short", () => {
  expect(days("in 3 days")).toEqual(["in 3 days = 2026-08-17"])
  expect(days("in 1 day")).toEqual(["in 1 day = 2026-08-15"])
  expect(days("in 2 weeks")).toEqual(["in 2 weeks = 2026-08-28"])
  expect(days("in 2w")).toEqual(["in 2 weeks = 2026-08-28"])
  expect(days("in 1 month")).toEqual(["in 1 month = 2026-09-14"])
})

test("a count crossing a month, and a year, is still integer arithmetic", () => {
  expect(days("in 30 days", "2026-12-20")).toEqual(["in 30 days = 2027-01-19"])
})

// ── a month and a day ──────────────────────────────────────────────────

test("a month and a day, either way round, with the month abbreviated", () => {
  expect(days("aug 20")).toEqual(["August 20, 2026 = 2026-08-20"])
  expect(days("20 aug")).toEqual(["August 20, 2026 = 2026-08-20"])
  expect(days("august 20")).toEqual(["August 20, 2026 = 2026-08-20"])
})

test("without a year it means the NEXT time that day comes round", () => {
  // Typed in August; February has gone, so it is next February. A widget for
  // scheduling should not offer the past first.
  expect(days("feb 3")).toEqual(["February 3, 2027 = 2027-02-03"])
})

test("a year said out loud is taken as said, past or not", () => {
  expect(days("aug 20 2019")).toEqual(["August 20, 2019 = 2019-08-20"])
})

test("a day that month does not have is not a day", () => {
  expect(days("feb 30")).toEqual([])
  expect(days("sep 31")).toEqual([])
})

test("february 29 is offered in the year that has one", () => {
  expect(days("feb 29", "2028-01-01")).toEqual(["February 29, 2028 = 2028-02-29"])
})

// ── the date itself ────────────────────────────────────────────────────

test("the ten characters typed out are their own answer", () => {
  expect(days("2026-09-01")).toEqual(["2026-09-01 = 2026-09-01"])
})

test("text that names no day at all answers with nothing", () => {
  // Which is what shuts the widget: there is no empty list to draw.
  expect(days("zzz")).toEqual([])
  expect(days("in a while")).toEqual([])
  expect(days("2026-13-01")).toEqual([])
})

// ── what a row says beside the phrase ──────────────────────────────────

test("every day is printed out loud, because `next friday` is an argument", () => {
  expect(dayLabel("2026-08-14")).toBe("Fri 14 Aug 2026")
  expect(dayLabel("2026-01-01")).toBe("Thu 1 Jan 2026")
})
