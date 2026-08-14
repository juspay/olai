/**
 * The directory's mark, over readings of a real set — `agendaOf` rather than a
 * hand-built `Agenda`, so a change to what the page collects reaches these
 * cases instead of passing them by.
 */

import { agendaOf, derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { lookOf } from "./owed.ts"

const located = (file: string, line: number, node: Located["node"]): Located => ({
  file,
  line,
  node,
})

/** The day every reading below is taken on — fixed, for the reason the format's
 *  own agenda tests fix one: a test that read a clock would expire. */
const TODAY = "2026-08-12"

const readingOf = (...nodes: ReadonlyArray<Located>) =>
  agendaOf(derive(nodes), TODAY)

const late = located("work.jsonl", 1, {
  id: "posts",
  ord: "a0",
  title: "dig the post holes",
  todo: true,
  date: "2026-08-03",
})
const alsoLate = located("life.jsonl", 1, {
  id: "visas",
  ord: "a0",
  title: "send the visa forms",
  doing: true,
  date: "2026-08-10",
})
const onToday = located("work.jsonl", 2, {
  id: "ferry",
  ord: "a1",
  title: "book the ferry",
  todo: true,
  date: TODAY,
})
const coming = located("work.jsonl", 3, {
  id: "pack",
  ord: "a2",
  title: "pack the bags",
  todo: true,
  date: "2026-08-14",
})

test("nothing owed is the entry it always was", () => {
  const look = lookOf(readingOf(coming))
  expect(look.face).toBe("quiet")
  expect(look.entry).toBe("")
  expect(look.chip).toBe("")
  expect(look.said).toBeUndefined()
})

test("what is COMING never lights it: a task due Friday is not news today", () => {
  const reading = readingOf(coming)
  expect(reading.upcoming.length).toBe(1)
  expect(lookOf(reading).face).toBe("quiet")
})

test("work on today is the quiet face — a nudge, and the row is untouched", () => {
  const look = lookOf(readingOf(onToday))
  expect(look.face).toBe("today")
  expect(look.count).toBe(1)
  expect(look.entry).toBe("")
  expect(look.chip).toContain("bg-pill")
  expect(look.said).toBe("Agenda — 1 on today")
})

test("late work is the loud face, and takes the row with it", () => {
  const look = lookOf(readingOf(late, alsoLate))
  expect(look.face).toBe("overdue")
  expect(look.count).toBe(2)
  // More than a colour: the row is washed and weighted too, so the two faces
  // are still two sights without one.
  expect(look.entry).toContain("bg-alarm/10")
  expect(look.entry).toContain("font-semibold")
  expect(look.chip).toContain("bg-alarm")
  expect(look.said).toBe("Agenda — 2 overdue")
})

test("both at once: the alarm wins the row, and the count is the LATE one", () => {
  const look = lookOf(readingOf(late, onToday))
  expect(look.face).toBe("overdue")
  expect(look.count).toBe(1)
  // Not lost, and said rather than shown: the number that decides whether to
  // press is the late one, and the other rides the sentence.
  expect(look.said).toBe("Agenda — 1 overdue, 1 on today")
})

test("an occurrence on today counts as the row it is, and is never called due", () => {
  const birthday = located("life.jsonl", 2, {
    id: "birthday",
    ord: "a1",
    title: "mum's birthday",
    date: TODAY,
  })
  const look = lookOf(readingOf(birthday))
  expect(look.face).toBe("today")
  expect(look.count).toBe(1)
  expect(look.said).toBe("Agenda — 1 on today")
  // And it can never be the loud one, however long ago its day was: a day
  // passing is not a failure of a bullet.
  const gone = located("life.jsonl", 3, {
    id: "delivery",
    ord: "a2",
    title: "the timber arrives",
    date: "2026-08-01",
  })
  expect(lookOf(readingOf(gone)).face).toBe("quiet")
})

test("a set nobody has read yet claims nothing", () => {
  const look = lookOf(undefined)
  expect(look.face).toBe("quiet")
  expect(look.count).toBe(0)
})
