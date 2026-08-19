/**
 * The directory's mark, over readings of a real set — `agendaOf` rather than a
 * hand-built `Agenda`, so a change to what the page collects reaches these
 * cases instead of passing them by, and `@olai/format/testlib` rather than
 * record literals, so every fixture here is text a real load would accept.
 */

import { agendaOf, derive } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { markOf } from "./owed.ts"

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

test("nothing owed is the entry it always was", () => {
  const mark = markOf(readingOf([COMING]))
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
  expect(markOf(reading).face).toBe("quiet")
})

test("work on today is the quiet face — a nudge, and the row is untouched", () => {
  const mark = markOf(readingOf([ON_TODAY]))
  expect(mark.face).toBe("today")
  expect(mark.count).toBe(1)
  expect(mark.entry).toBe("")
  expect(mark.chip).toContain("bg-pill")
  expect(mark.said).toBe("Agenda — 1 on today")
})

test("late work is the loud face, and takes the row with it", () => {
  const mark = markOf(readingOf([LATE], [ALSO_LATE]))
  expect(mark.face).toBe("overdue")
  // Two nodes over two outlines: a mark saying 2 means two things are late.
  expect(mark.count).toBe(2)
  // More than a colour: the row is washed and weighted too, so the two faces
  // are still two sights without one.
  expect(mark.entry).toContain("bg-alarm/10")
  expect(mark.entry).toContain("font-semibold")
  expect(mark.chip).toContain("bg-alarm")
  expect(mark.said).toBe("Agenda — 2 overdue")
})

test("the rail's two marks differ by SHAPE, not only by colour", () => {
  // They share one corner over one glyph, so a reader who cannot separate the
  // two hues still has a filled dot against a ring.
  expect(markOf(readingOf([LATE])).dot).toBe("bg-alarm")
  expect(markOf(readingOf([ON_TODAY])).dot).toContain("border")
})

test("both at once: the alarm wins the row, and the count is the LATE one", () => {
  const mark = markOf(readingOf([LATE, ON_TODAY]))
  expect(mark.face).toBe("overdue")
  expect(mark.count).toBe(1)
  // Not lost, and said rather than shown: the number that decides whether to
  // press is the late one, and the other rides the sentence.
  expect(mark.said).toBe("Agenda — 1 overdue, 1 on today")
})

test("an occurrence on today counts as the row it is, and is never called due", () => {
  const birthday = `{"id":"birthday","ord":"a0","title":"mum's birthday","date":"${TODAY}"}`
  const mark = markOf(readingOf([birthday]))
  expect(mark.face).toBe("today")
  expect(mark.count).toBe(1)
  expect(mark.said).toBe("Agenda — 1 on today")
  // And it can never be the loud one, however long ago its day was: a day
  // passing is not a failure of a bullet.
  const gone = `{"id":"delivery","ord":"a0","title":"the timber arrives","date":"2026-08-01"}`
  expect(markOf(readingOf([gone])).face).toBe("quiet")
})

test("a set nobody has read yet claims nothing", () => {
  const mark = markOf(undefined)
  expect(mark.face).toBe("quiet")
  expect(mark.count).toBe(0)
  expect(mark.owed).toEqual({ overdue: 0, today: 0 })
})
