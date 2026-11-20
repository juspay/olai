import { TEST_CLAIMS } from "@olai/format/testlib"
import { agendaOf, derive, type Owed, owedOf } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { markOf, unchanged } from "./owed.ts"

const TODAY = "2026-08-12"

const LATE = `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-03"}`
const ALSO_LATE = `{"id":"visas","ord":"a0","title":"send the visa forms","doing":true,"date":"2026-08-10"}`
const ON_TODAY = `{"id":"ferry","ord":"a1","title":"book the ferry","todo":true,"date":"${TODAY}"}`
const COMING = `{"id":"pack","ord":"a2","title":"pack the bags","todo":true,"date":"2026-08-14"}`

const readingOf = (work: ReadonlyArray<string>, life: ReadonlyArray<string> = []) =>
  agendaOf(
    derive(TEST_CLAIMS,
      nodesOfFiles({ "work.olai": work.join("\n"), "life.olai": life.join("\n") }),
    ),
    TODAY,
  )

const countedOf = (work: ReadonlyArray<string>, life: ReadonlyArray<string> = []) =>
  owedOf(readingOf(work, life))

test("nothing owed is the entry it always was", () => {
  const mark = markOf(countedOf([COMING]))
  expect(mark.face).toBe("quiet")
  expect(mark.chip).toBe("")
  expect(mark.dot).toBe("")
  expect(mark.said).toBeUndefined()
  expect(mark.entry).toBe("")
})

test("what is COMING never lights it: a task due Friday is not news today", () => {
  const reading = readingOf([COMING])
  expect(reading.upcoming.length).toBe(1)
  expect(markOf(owedOf(reading)).face).toBe("quiet")
})

test("work on today is the quiet face — a nudge, and the row is untouched", () => {
  const mark = markOf(countedOf([ON_TODAY]))
  expect(mark.face).toBe("today")
  expect(mark.count).toBe(1)
  expect(mark.entry).toBe("")
  expect(mark.said).toBe("Agenda — 1 due today")
})

test("late work is the loud face, and takes the row with it", () => {
  const mark = markOf(countedOf([LATE], [ALSO_LATE]))
  expect(mark.face).toBe("overdue")
  expect(mark.count).toBe(2)
  expect(mark.entry).not.toBe("")
  expect(mark.said).toBe("Agenda — 2 overdue")
})

test("both at once: the alarm wins the row, and the count is the LATE one", () => {
  const mark = markOf(countedOf([LATE, ON_TODAY]))
  expect(mark.face).toBe("overdue")
  expect(mark.count).toBe(1)
  expect(mark.said).toBe("Agenda — 1 overdue, 1 due today")
})

test("an occurrence on today is not a row this mark counts", () => {
  const birthday = `{"id":"birthday","ord":"a0","title":"mum's birthday","date":"${TODAY}"}`
  const mark = markOf(countedOf([birthday]))
  expect(mark.face).toBe("quiet")
  expect(mark.count).toBe(0)
  expect(mark.said).toBeUndefined()
  const gone = `{"id":"delivery","ord":"a0","title":"the timber arrives","date":"2026-08-01"}`
  expect(markOf(countedOf([gone])).face).toBe("quiet")
})

test("a directory nobody has been told about yet claims nothing", () => {
  const mark = markOf(undefined)
  const owed: Owed = mark.owed
  expect(mark.face).toBe("quiet")
  expect(mark.count).toBe(0)
  expect(owed).toEqual({ overdue: 0, today: 0 })
})

test("a painted chip is never a zero — CountChip hides at zero on this", () => {
  const marks = [
    markOf(undefined),
    markOf(countedOf([COMING])),
    markOf(countedOf([ON_TODAY])),
    markOf(countedOf([LATE], [ALSO_LATE])),
    markOf(countedOf([LATE, ON_TODAY])),
  ]
  for (const mark of marks) {
    if (mark.chip !== "") expect(mark.count).toBeGreaterThan(0)
    if (mark.count === 0) expect(mark.chip).toBe("")
  }
})

test("a mark is a VALUE: the counts are copied into a frozen snapshot", () => {
  const live = { overdue: 3, today: 1 }
  const before = markOf(live)
  live.overdue = 4
  const after = markOf(live)
  expect(before.owed.overdue).toBe(3)
  expect(before.count).toBe(3)
  expect(after.count).toBe(4)
  expect(Object.isFrozen(before.owed)).toBe(true)
  expect(unchanged(before, after)).toBe(false)
})


import { phraseOf } from "./owed.ts"
test("the entry and reminder share the exact count phrase", () => {
  for (const [owed, phrase] of [
    [{ overdue: 2, today: 0 }, "2 overdue"],
    [{ overdue: 0, today: 3 }, "3 due today"],
    [{ overdue: 2, today: 3 }, "2 overdue, 3 due today"],
  ] as const) {
    expect(phraseOf(owed)).toBe(phrase)
    expect(markOf(owed).said).toBe(`Agenda — ${phrase}`)
  }
  expect(phraseOf({ overdue: 0, today: 0 })).toBe("")
  expect(markOf({ overdue: 0, today: 0 }).said).toBeUndefined()
})
