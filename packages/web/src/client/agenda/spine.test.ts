/**
 * The line's own arithmetic: which days are on it, in what order, and what is
 * between them.
 *
 * The half of the spine that is not a component. Everything a day says about
 * itself is `@olai/format`'s (tested there); what is tested here is the
 * ASSEMBLY — that now is always a place on the line, that a rung knows the ink
 * the line arrives wearing, and that the gradient a rung paints changes across
 * the silence rather than across the rows.
 */

import type { Agenda, DayEntry } from "@olai/format"
import { expect, test } from "bun:test"

import { inkOf, lineOf, rungsOf } from "./spine.ts"

const TODAY = "2026-08-18"

/** A day with something on it. What the rows ARE is nobody's business here —
 *  the line is about days. */
const day = (date: string): { date: string; groups: Agenda["today"] } => ({
  date,
  groups: [{ file: "work.olai", nodes: [] as unknown as ReadonlyArray<DayEntry> }],
})

const agenda = (parts: Partial<Agenda>): Agenda => ({
  overdue: [],
  today: [],
  upcoming: [],
  ...parts,
})

test("now is always a place on the line, between what has gone and what is coming", () => {
  const rungs = rungsOf(
    agenda({ overdue: [day("2026-08-17")], upcoming: [day("2026-08-24")] }),
    TODAY,
  )
  expect(rungs.map((rung) => rung.day.date)).toEqual([
    "2026-08-17",
    TODAY,
    "2026-08-24",
  ])
  expect(rungs.map((rung) => rung.felt.standing)).toEqual(["late", "today", "ahead"])
})

test("today is on the line with nothing on it, which is the whole ruling", () => {
  // "Now is a place on the line, not a section that vanishes." A directory with
  // one late task and a clear day still draws the dot.
  const rungs = rungsOf(agenda({ overdue: [day("2026-08-17")] }), TODAY)
  expect(rungs.map((rung) => rung.day.date)).toEqual(["2026-08-17", TODAY])
  expect(rungs.at(-1)!.day.groups).toEqual([])
})

test("each rung knows the ink the line arrives wearing, and the first wears none", () => {
  const rungs = rungsOf(
    agenda({ overdue: [day("2026-08-17")], upcoming: [day("2026-10-30")] }),
    TODAY,
  )
  expect(rungs.map((rung) => rung.from)).toEqual([undefined, "alarm", "accent"])
  expect(rungs.map((rung) => rung.felt.tone)).toEqual(["alarm", "accent", "rule"])
})

test("the first rung is a lead-in and never a silence", () => {
  // There is no earlier day for it to be between, so it carries no label
  // however far back the directory's oldest slipped task is.
  const [first] = rungsOf(agenda({ overdue: [day("2019-11-05")] }), TODAY)
  expect(first!.quiet.label).toBeUndefined()
  expect(first!.quiet.days).toBe(0)
  expect(first!.quiet.space).toBeGreaterThan(0)
})

test("the silence before a day is the wait since the day above it", () => {
  const rungs = rungsOf(
    agenda({ upcoming: [day("2026-08-24"), day("2026-09-06")] }),
    TODAY,
  )
  // today → the 24th is six days and says nothing; the 24th → the 6th is
  // thirteen, which is two quiet weeks.
  expect(rungs[1]!.quiet).toMatchObject({ days: 6, label: undefined })
  expect(rungs[2]!.quiet).toMatchObject({ days: 13, label: "two quiet weeks" })
})

test("a rung's stretch of line changes across the SILENCE, then holds", () => {
  const [, , far] = rungsOf(
    agenda({ upcoming: [day("2026-08-24"), day("2026-10-30")] }),
    TODAY,
  )
  const painted = lineOf(far!)
  // From the day above's ink, to its own by the time the wait is over, and flat
  // from there — so a day with twenty rows on it is one colour all the way
  // down rather than a row-by-row fade.
  expect(painted).toContain(`${inkOf("ink")} 0`)
  expect(painted).toContain(`${inkOf("rule")} ${far!.quiet.space}rem`)
  expect(painted).toContain(`${inkOf("rule")} 100%`)
})
