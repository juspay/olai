/**
 * The order of the two prunings, the counts that make it legible, and the four
 * shapes a page can be.
 *
 * What a query SELECTS is `@olai/format`'s and is tested there (`filter.test.ts`
 * holds the grammar). What is pinned here is the browser's own decision: the
 * done preference goes first, the filter reads what it left, the number of
 * matches it held back is said out loud rather than left as a mystery — and the
 * same one query narrows a tree, a day, the agenda and the trash, each in the
 * shape that page draws.
 *
 * Each case builds the reading over a FIXED query rather than typing into a
 * signal, which is deliberate: under `bun test` there is no DOM, so `solid-js`
 * resolves to its server build and a memo is computed once instead of tracking.
 * Nothing here is a claim about Solid's graph — it is a claim about what this
 * file computes from three inputs, and that is exactly what a fixed query asks.
 */

import {
  agendaOf,
  type Agenda,
  type DayGroup,
  datedOn,
  derive,
  type Row,
  rowsOf,
  withoutDone,
} from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { only } from "../narrow.ts"
import type { Drawn } from "../page.ts"
import { createNarrowing, type Narrowing } from "./narrowing.ts"

const derived = derive(nodesOfFiles({
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":true}`,
    `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters #home","done":"2026-08-03"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"date":"2026-08-14"}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"pick the hinges #home","todo":true,"date":"2026-08-14"}`,
  ].join("\n"),
  // What was put away — the trash's own page, and the one reading whose rows a
  // query would otherwise refuse to look at.
  "Archive.olai": [
    `{"id":"old-kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"tiles","parent":"old-kitchen","ord":"a0","title":"choose the tiles","todo":true}`,
    `{"id":"grout","parent":"old-kitchen","ord":"a1","title":"pick the grout"}`,
  ].join("\n"),
}))

/** The day these pages are read on. Fixed, because the grammar's relative
 *  words count from the tab's clock and a test that read the real one would
 *  pass today and fail on Monday. */
const TODAY = "2026-08-17"

/** The page, at one query and one preference — the same inputs `App.tsx`
 *  hands over. The done preference reaches the TREE and nothing else, which is
 *  where it reaches in the app. */
const narrowing = (drawn: Drawn, text: string, hideDone = false): Narrowing =>
  createRoot(() =>
    createNarrowing({
      derived: () => derived,
      text: () => text,
      all: () => drawn,
      visible: () =>
        hideDone && drawn.kind === "tree"
          ? { kind: "tree", rows: withoutDone(drawn.rows) }
          : drawn,
      today: () => TODAY,
    })
  )

const tree: Drawn = { kind: "tree", rows: rowsOf(derived, "house.olai") }
const page = (text: string, hideDone = false): Narrowing =>
  narrowing(tree, text, hideDone)

test("an empty box is not a filter, and the page is the page", () => {
  const reading = page("")
  expect(reading.active()).toBe(false)
  expect(rowsIn(reading)).toHaveLength(1)
  // The counts are only ever drawn beside an active filter, so an unfiltered
  // page does not walk its own tree to produce them.
  expect(reading.total()).toBe(0)
  expect(reading.shown()).toBe(0)
})

test("a filtered page counts the rows it draws, of the rows it holds", () => {
  const reading = page("hinges")
  expect(reading.shown()).toBe(1)
  expect(reading.total()).toBe(5)
})

test("a query keeps its matches and the ancestors that lead to them", () => {
  const reading = page("hinges")
  expect(reading.active()).toBe(true)
  expect(reading.shown()).toBe(1)
  // `kitchen` → `install` → `hinges`: one match, two ancestors kept as the
  // context that makes a bare title mean something.
  expect(flat(rowsIn(reading))).toEqual(["kitchen", "install", "hinges"])
})

// The preference is a standing claim about the READER; the filter is a question
// about the page. So the preference goes first — and the consequence is said
// rather than special-cased.
test("finished work is hidden before the query is asked, and the difference is reported", () => {
  const showing = page("#home")
  expect(showing.shown()).toBe(3)
  expect(showing.hiddenAsDone()).toBe(0)

  // `demo` carries `#home` and is done: it is not on the page to be matched.
  const hiding = page("#home", true)
  expect(hiding.shown()).toBe(2)
  expect(hiding.hiddenAsDone()).toBe(1)
})

test("`is:done` under a reader who hides finished work says why it found nothing", () => {
  const hiding = page("is:done", true)
  expect(rowsIn(hiding)).toEqual([])
  expect(hiding.shown()).toBe(0)
  expect(hiding.hiddenAsDone()).toBe(1)
})

// The one door that parses for itself gets the relative words from the same
// grammar, counted from the tab's own clock — which is why the day is an input
// of this reading rather than something `parseFilter` reaches for. `demo` was
// finished on the 3rd of August, the month the page is being read in.
test("a relative date is counted from the day the page is being read on", () => {
  const reading = page("date:this-month")
  expect(reading.shown()).toBe(3)
  expect(flat(rowsIn(reading)))
    .toEqual(["kitchen", "demo", "order", "install", "hinges"])
  // Nothing on this page is dated in the week of the 17th.
  expect(rowsIn(page("date:this-week"))).toEqual([])
})

// A query the grammar could not read is ACTIVE — the bar stays up, the tree
// empties, and the refusal is what the reader is shown. Answering with the half
// that parsed would be a list that looks like an answer.
test("a refused operator empties the page and carries its reason", () => {
  const reading = page("is:open")
  expect(reading.active()).toBe(true)
  expect(rowsIn(reading)).toEqual([])
  expect(reading.refusals().map((one) => one.token)).toEqual(["is:open"])
})

// ── the pages that are a date question ─────────────────────────────────

/** A day, as the app hands it over: the dated nodes, and the note somebody
 *  wrote on it — both on the screen, and only one of them something a query can
 *  select. */
const dayOf = (date: string, notes: ReadonlyArray<string> = []): Drawn => ({
  kind: "day",
  groups: datedOn(derived, date),
  notes,
})

// A day's rows are FLAT and each arrives with its own ancestry, so narrowing
// one keeps nothing as context: what is left is exactly what matched.
test("a day keeps the rows that matched, and drops the outline that has none", () => {
  const whole = dayOf("2026-08-14")
  expect(datedIds(whole)).toEqual(["order", "hinges"])

  const reading = narrowing(whole, "hinges")
  expect(reading.shown()).toBe(1)
  expect(reading.total()).toBe(2)
  expect(datedIds(reading.drawn())).toEqual(["hinges"])

  // Nothing on the day matched, so the outline that held both rows goes with
  // them — a heading over no rows would say that file still has something on
  // this day.
  const none = narrowing(whole, "bathroom")
  expect(groupsIn(none.drawn())).toEqual([])
  expect(none.shown()).toBe(0)
  expect(none.total()).toBe(2)
})

// A note is a DOCUMENT, which is the one page kind that takes no filter at all
// — so it can never be a match, and a filtered day is the answer rather than
// the answer plus somebody's prose.
test("a day's note goes while a filter is on, and comes back when it clears", () => {
  const written = dayOf("2026-08-14", ["Daily/2026-08-14.md"])
  expect(notesIn(narrowing(written, "").drawn())).toEqual(["Daily/2026-08-14.md"])
  expect(notesIn(narrowing(written, "hinges").drawn())).toEqual([])
  // Including the query that found nothing at all: the page is the answer.
  expect(notesIn(narrowing(written, "bathroom").drawn())).toEqual([])
})

const agenda: Agenda = agendaOf(derived, TODAY)
const owed: Drawn = { kind: "agenda", agenda }

test("the agenda narrows section by section, and counts every row it draws", () => {
  // Both dated tasks slipped on the 14th, and neither is finished.
  expect(agenda.overdue.flatMap((group) => group.nodes.map((one) => one.shows.node.id)))
    .toEqual(["order", "hinges"])

  const reading = narrowing(owed, "is:todo")
  expect(reading.total()).toBe(2)
  expect(reading.shown()).toBe(1)
  const drawn = reading.drawn()
  expect(drawn.kind === "agenda" ? drawn.agenda.overdue.length : -1).toBe(1)
  expect(datedIds(drawn)).toEqual(["hinges"])
})

// ── the trash, where a query would otherwise refuse to look ────────────

const trash: Drawn = {
  kind: "trash",
  files: ["Archive.olai"],
  groups: [{ file: "Archive.olai", rows: rowsOf(derived, "Archive.olai") }],
}

// The rule this page exists to except: archived nodes are out of every reading
// unless the query says `is:archived` — and this page IS the archive, so a
// plain word searches what is in front of the reader rather than nothing.
test("a word typed on the trash searches what was put away", () => {
  const reading = narrowing(trash, "grout")
  expect(reading.shown()).toBe(1)
  expect(reading.total()).toBe(3)
  // The pile's own scaffold is kept as the context that says where it came
  // from — the tree rule, on a tree of archives.
  expect(flat(archiveRows(reading.drawn()))).toEqual(["old-kitchen", "grout"])
})

test("an archive with nothing left is not drawn at all", () => {
  const reading = narrowing(trash, "bathroom")
  expect(archiveRows(reading.drawn())).toEqual([])
  expect(reading.shown()).toBe(0)
})

// The operator still means what it means: on the page that is the archive,
// `is:archived` selects everything and its negation selects nothing.
test("`is:archived` and its negation still say what they say here", () => {
  expect(narrowing(trash, "is:archived").shown()).toBe(3)
  expect(narrowing(trash, "-is:archived").shown()).toBe(0)
})

// ...and the page that shows no archived rows is unaffected by the flag: the
// scope is the page, and this page's rows are the outline's.
test("a tree page draws nothing more for the archive being in scope", () => {
  const reading = page("is:archived")
  expect(rowsIn(reading)).toEqual([])
  expect(reading.shown()).toBe(0)
})

// ── a page a filter has nothing to narrow ──────────────────────────────

test("a page with nothing to narrow counts nothing and stays itself", () => {
  const reading = narrowing({ kind: "none" }, "hinges")
  expect(reading.drawn()).toEqual({ kind: "none" })
  expect(reading.shown()).toBe(0)
  expect(reading.total()).toBe(0)
})

const rowsIn = (reading: Narrowing): ReadonlyArray<Row> =>
  only(reading.drawn(), "tree")?.rows ?? []

const archiveRows = (drawn: Drawn): ReadonlyArray<Row> =>
  only(drawn, "trash")?.groups.flatMap((group) => group.rows) ?? []

const notesIn = (drawn: Drawn): ReadonlyArray<string> =>
  only(drawn, "day")?.notes ?? []

/** Every group a date-shaped page draws, whichever of the two it is — the
 *  agenda's three sections read as the one list they are made of. */
const groupsIn = (drawn: Drawn): ReadonlyArray<DayGroup> => {
  const day = only(drawn, "day")
  if (day !== undefined) return day.groups
  const owed = only(drawn, "agenda")?.agenda
  return owed === undefined ? [] : [
    ...owed.overdue,
    ...owed.today,
    ...owed.upcoming.flatMap((ahead) => ahead.groups),
  ]
}

const datedIds = (drawn: Drawn): ReadonlyArray<string> =>
  groupsIn(drawn).flatMap((group) => group.nodes.map((one) => one.shows.node.id))

const flat = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [row.at.node.id, ...flat(row.children)])
