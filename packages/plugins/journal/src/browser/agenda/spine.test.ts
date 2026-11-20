import type { Agenda, DayEntry } from "@olai/format"
import { expect, test } from "bun:test"

import { inkOf, lineOf, spaceOf, trackOf } from "./spine.ts"

const TODAY = "2026-08-18"

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
  const { rungs } = lineOf(
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
  const { rungs } = lineOf(agenda({ overdue: [day("2026-08-17")] }), TODAY)
  expect(rungs.map((rung) => rung.day.date)).toEqual(["2026-08-17", TODAY])
  expect(rungs.at(-1)!.day.groups).toEqual([])
})

test("each rung knows the ink the line arrives wearing, and the first wears none", () => {
  const { rungs } = lineOf(
    agenda({ overdue: [day("2026-08-17")], upcoming: [day("2026-10-30")] }),
    TODAY,
  )
  expect(rungs.map((rung) => rung.from)).toEqual([undefined, "alarm", "accent"])
  expect(rungs.map((rung) => rung.felt.tone)).toEqual(["alarm", "accent", "rule"])
})

test("the line ends in the tone of its last day, and in today's when none is coming", () => {
  expect(
    lineOf(agenda({ overdue: [day("2026-08-17")], upcoming: [day("2026-10-30")] }), TODAY).ending,
  ).toBe("rule")
  expect(lineOf(agenda({ overdue: [day("2026-08-17")] }), TODAY).ending).toBe("accent")
  expect(lineOf(agenda({}), TODAY).ending).toBe("accent")
})

test("the first rung is a lead-in and never a silence", () => {
  const [first] = lineOf(agenda({ overdue: [day("2019-11-05")] }), TODAY).rungs
  expect(first!.quiet).toBeUndefined()
  expect(spaceOf(first!)).toBeGreaterThan(0)
})

test("the silence before a day is the wait since the day above it", () => {
  const { rungs } = lineOf(
    agenda({ upcoming: [day("2026-08-24"), day("2026-09-06")] }),
    TODAY,
  )
  expect(rungs[1]!.quiet).toMatchObject({ days: 6, label: undefined })
  expect(rungs[2]!.quiet).toMatchObject({ days: 13, label: "two quiet weeks" })
})

test("a rung's stretch of line changes across the SILENCE, then holds", () => {
  const [, , far] = lineOf(
    agenda({ upcoming: [day("2026-08-24"), day("2026-10-30")] }),
    TODAY,
  ).rungs
  const painted = trackOf(far!)
  expect(painted).toContain(`${inkOf("ink")} 0`)
  expect(painted).toContain(`${inkOf("rule")} ${spaceOf(far!)}rem`)
  expect(painted).toContain(`${inkOf("rule")} 100%`)
})
