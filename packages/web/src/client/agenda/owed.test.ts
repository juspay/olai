/**
 * The directory's mark, over readings of a real set — `owedOf(agendaOf(…))`
 * rather than a hand-built pair of numbers, so a change to what the page
 * collects reaches these cases instead of passing them by, and
 * `@olai/format/testlib` rather than record literals, so every fixture here is
 * text a real load would accept.
 *
 * THE COUNTING NOW HAPPENS ON THE SERVER (`docs/brainstorming/
 * vault-in-browser.md`'s PR 4), which changes what this file is a test OF and
 * not what it is a test over: the mark's table is still the browser's, so this
 * is still the place its faces, its loud-wins-whole ruling and its sentence are
 * pinned. The fixture calls the same two `@olai/format` functions the server's
 * reading calls (`@olai/ops`' `Query.owed`), so a change to either still
 * reaches every case here. What that reading answers over a real snapshot is
 * pinned beside it, in `packages/ops/src/query.test.ts`.
 */

import { agendaOf, derive, owedOf } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { markOf, unchanged } from "./owed.ts"

/** The day every reading below is taken on — fixed, for the reason the format's
 *  own agenda tests fix one: a test that read a clock would expire. */
const TODAY = "2026-08-12"

const LATE = `{"id":"posts","ord":"a0","title":"dig the post holes","todo":true,"date":"2026-08-03"}`
const ALSO_LATE = `{"id":"visas","ord":"a0","title":"send the visa forms","doing":true,"date":"2026-08-10"}`
const ON_TODAY = `{"id":"ferry","ord":"a1","title":"book the ferry","todo":true,"date":"${TODAY}"}`
const COMING = `{"id":"pack","ord":"a2","title":"pack the bags","todo":true,"date":"2026-08-14"}`

/** One reading of a directory of two outlines — `work.olai` is what the first
 *  argument holds, `life.olai` the second, because a count of NODES has to be
 *  exercised across the groups an agenda comes in. */
const readingOf = (work: ReadonlyArray<string>, life: ReadonlyArray<string> = []) =>
  agendaOf(
    derive(
      nodesOfFiles({ "work.olai": work.join("\n"), "life.olai": life.join("\n") }),
    ),
    TODAY,
  )

/** …and what the wire carries of it: the two numbers, counted the one way
 *  (`owedOf`). What the MARK is handed, since PR 4. */
const countedOf = (work: ReadonlyArray<string>, life: ReadonlyArray<string> = []) =>
  owedOf(readingOf(work, life))

test("nothing owed is the entry it always was", () => {
  const mark = markOf(countedOf([COMING]))
  expect(mark.face).toBe("quiet")
  expect(mark.chip).toBe("")
  expect(mark.dot).toBe("")
  expect(mark.said).toBeUndefined()
  // Empty: the spine already paints paper, and a second ink would hide it.
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
  expect(mark.said).toBe("Agenda — 1 on today")
})

test("late work is the loud face, and takes the row with it", () => {
  const mark = markOf(countedOf([LATE], [ALSO_LATE]))
  expect(mark.face).toBe("overdue")
  // Two nodes over two outlines: a mark saying 2 means two things are late.
  expect(mark.count).toBe(2)
  // The row is marked too, so the two faces are still two sights without one.
  expect(mark.entry).not.toBe("")
  expect(mark.said).toBe("Agenda — 2 overdue")
})

test("both at once: the alarm wins the row, and the count is the LATE one", () => {
  const mark = markOf(countedOf([LATE, ON_TODAY]))
  expect(mark.face).toBe("overdue")
  expect(mark.count).toBe(1)
  // Not lost, and said rather than shown: the number that decides whether to
  // press is the late one, and the other rides the sentence.
  expect(mark.said).toBe("Agenda — 1 overdue, 1 on today")
})

test("an occurrence on today is not a row this mark counts", () => {
  // The agenda lists work. A birthday is on today's PAGE and in the calendar;
  // it is not owed, so the entry stays the door it always was.
  const birthday = `{"id":"birthday","ord":"a0","title":"mum's birthday","date":"${TODAY}"}`
  const mark = markOf(countedOf([birthday]))
  expect(mark.face).toBe("quiet")
  expect(mark.count).toBe(0)
  expect(mark.said).toBeUndefined()
  // And it can never be the loud one, however long ago its day was: a day
  // passing is not a failure of a bullet.
  const gone = `{"id":"delivery","ord":"a0","title":"the timber arrives","date":"2026-08-01"}`
  expect(markOf(countedOf([gone])).face).toBe("quiet")
})

test("a directory nobody has been told about yet claims nothing", () => {
  const mark = markOf(undefined)
  expect(mark.face).toBe("quiet")
  expect(mark.count).toBe(0)
  expect(mark.owed).toEqual({ overdue: 0, today: 0 })
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

test("a mark is a VALUE: the counts are copied, not held by reference", () => {
  // The wire hands this table a LIVE value — a reconciled store whose identity
  // survives every frame and whose fields move under it. Held by reference,
  // `unchanged` would be comparing one object to itself and would report
  // "nothing changed" for a directory that had gone from three late to four:
  // the chip frozen at 3 while `data-overdue` beside it, read straight through
  // the same live object, said 4. That is what the first shot of this change
  // caught, and this is the pin under the fix.
  const live = { overdue: 3, today: 1 }
  const before = markOf(live)
  live.overdue = 4
  const after = markOf(live)
  expect(before.owed.overdue).toBe(3)
  expect(before.count).toBe(3)
  expect(after.count).toBe(4)
  expect(unchanged(before, after)).toBe(false)
})
