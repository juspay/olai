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
  rowsUnder,
  withoutDone,
  zoom,
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
  // query would otherwise refuse to look at. `shims` is DATED on purpose, and
  // what it proves is now an ABSENCE: a day and the agenda collect dates out of
  // a walk that leaves the archive out (`@olai/format`'s `dates.ts`, ruled
  // 2026-08-17), so this row reaches neither page and the trash is where it is
  // read.
  "Archive.olai": [
    `{"id":"old-kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"tiles","parent":"old-kitchen","ord":"a0","title":"choose the tiles","todo":true}`,
    `{"id":"grout","parent":"old-kitchen","ord":"a1","title":"pick the grout"}`,
    `{"id":"shims","parent":"old-kitchen","ord":"a2","title":"return the shims","todo":true,"date":"2026-08-14"}`,
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
  expect(treeRows(reading)).toHaveLength(1)
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
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
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
  expect(treeRows(hiding)).toEqual([])
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
  expect(flat(treeRows(reading)))
    .toEqual(["kitchen", "demo", "order", "install", "hinges"])
  // Nothing on this page is dated in the week of the 17th.
  expect(treeRows(page("date:this-week"))).toEqual([])
})

// A query the grammar could not read is ACTIVE — the bar stays up, the tree
// empties, and the refusal is what the reader is shown. Answering with the half
// that parsed would be a list that looks like an answer.
test("a refused operator empties the page and carries its reason", () => {
  const reading = page("is:open")
  expect(reading.active()).toBe(true)
  expect(treeRows(reading)).toEqual([])
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
  // `shims` is dated the 14th and was put away, so it is on neither of these
  // pages any more (the test below is the claim; this is the count it changes).
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

/**
 * The archive on a page that is not the trash: there is none to find.
 *
 * The 2026-08-17 ruling, read from the filter's side. `shims` is an archived
 * node dated the 14th, and it is off the day and off the agenda before a query
 * is typed (`@olai/format`'s `dates.ts`) — so the flag this file used to set for
 * those two pages has nothing left to be true about, and the operator that
 * reaches the archive from anywhere reaches nothing HERE, because a filter
 * narrows the page rather than re-asking its question.
 */
test("a day draws no archived row, so no query finds one on it", () => {
  const whole = dayOf("2026-08-14")
  const sought = narrowing(whole, "shims")
  expect(sought.shown()).toBe(0)
  expect(datedIds(sought.drawn())).toEqual([])
  // The operator says the same thing from either side: nothing to select, and
  // nothing for its negation to take away.
  expect(narrowing(whole, "is:archived").shown()).toBe(0)
  expect(datedIds(narrowing(whole, "-is:archived").drawn()))
    .toEqual(["order", "hinges"])
})

test("the agenda answers the same way, over the dates read forward", () => {
  const forward: Drawn = { kind: "agenda", agenda: agendaOf(derived, TODAY) }
  expect(datedIds(forward)).toEqual(["order", "hinges"])

  expect(narrowing(forward, "shims").shown()).toBe(0)
  expect(narrowing(forward, "is:archived").shown()).toBe(0)
  expect(datedIds(narrowing(forward, "-is:archived").drawn()))
    .toEqual(["order", "hinges"])
})

// And the page that draws NONE of them: an outline holds no archived row of its
// own (an archive's address opens the trash), so nothing the archive carries is
// on it whatever the query says.
//
// WHAT THIS DOES NOT PIN is the flag: `shims` is dropped here by the page prune
// whether the scope was widened or not, so a `tree` arm that regressed to
// `true` would leave it green. The observable half is the zoom below, which
// fails without the arm.
test("an outline draws no archived row, whatever is typed", () => {
  expect(page("shims").shown()).toBe(0)
  expect(treeRows(page("shims"))).toEqual([])
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
  // Everything dated the 14th slipped, and none of it is finished — except the
  // archived one, which is on no section at all now that what was put away is
  // the trash's alone.
  expect(agenda.overdue.flatMap((group) => group.nodes.map((one) => one.shows.node.id)))
    .toEqual(["order", "hinges"])

  const reading = narrowing(owed, "is:todo")
  expect(reading.total()).toBe(2)
  expect(reading.shown()).toBe(1)
  const drawn = reading.drawn()
  // One outline's worth of overdue rows left, narrowed to the one that says
  // `todo` — `order` is `doing`, and the archive is not here to be a second
  // group.
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
  expect(reading.total()).toBe(4)
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
  expect(narrowing(trash, "is:archived").shown()).toBe(4)
  expect(narrowing(trash, "-is:archived").shown()).toBe(0)
})

// ...and `is:archived` typed on an outline draws nothing, which is the prune
// rather than the scope: the operator opens the archive by naming it, and the
// page has none of it to keep.
test("`is:archived` on an outline still draws that outline's nothing", () => {
  const reading = page("is:archived")
  expect(treeRows(reading)).toEqual([])
  expect(reading.shown()).toBe(0)
})

// The OTHER tree, and the reason that arm survived the ruling: `/n/<id>` on a
// node somebody put away is a tree whose rows are archived, and it is exactly
// where an `is:archived` hit lands when a reader clicks it (docs/search.md —
// what was taken away is the default presence, never the reachability). A
// matcher applying the default there would empty a page the reader asked for
// by name.
test("a zoom onto an archived node is searched like the pile it is in", () => {
  const zoomed = zoom(derived, "old-kitchen")
  // Named rather than defaulted to an empty tree: a fixture whose archive stopped
  // holding this node should fail here, not as a mystifying empty page below.
  if (zoomed.kind !== "node") throw new Error(`the archive has no \`old-kitchen\``)
  const inArchive: Drawn = {
    kind: "tree",
    rows: rowsUnder(derived, zoomed.shows, zoomed.trail),
  }
  const reading = narrowing(inArchive, "grout")
  expect(flat(treeRows(reading))).toEqual(["grout"])
  expect(reading.shown()).toBe(1)
  expect(narrowing(inArchive, "is:archived").shown()).toBe(3)
})

// ── a page a filter has nothing to narrow ──────────────────────────────

test("a page with nothing to narrow counts nothing and stays itself", () => {
  const reading = narrowing({ kind: "none" }, "hinges")
  expect(reading.drawn()).toEqual({ kind: "none" })
  expect(reading.shown()).toBe(0)
  expect(reading.total()).toBe(0)
})

const treeRows = (reading: Narrowing): ReadonlyArray<Row> =>
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

// ── the two prunings, on the one page that is inside an archive ────────

/**
 * The done preference must not decide which pages the ARCHIVE is in scope for.
 *
 * A zoom onto archived work is a tree, and an archive is mostly finished work —
 * so a reader who hides `done` can be looking at a page whose every root is
 * hidden. Asked of the page AFTER that pruning, the archive scope reads `false`
 * there, the matcher then leaves the whole archive out, and the bar says "0 of
 * 0" with nothing about the matches the preference is holding back — which is
 * the one sentence `hiddenAsDone` exists to make instead of a mystery.
 *
 * Which pages draw archived rows is a fact about the PAGE, so it is asked of
 * the unfiltered one (`source.all()`), which is what `hiddenAsDone` measures
 * against too.
 */
const FINISHED = derive(nodesOfFiles({
  "Archive.olai": [
    `{"id":"old-bath","ord":"a0","title":"bathroom #home","done":"2026-08-01"}`,
    `{"id":"taps","parent":"old-bath","ord":"a0","title":"the taps #home","done":"2026-08-02"}`,
  ].join("\n"),
}))

test("hiding finished work does not take the archive out of a zoom's scope", () => {
  const rows = rowsOf(FINISHED, "Archive.olai")
  // A PLAIN WORD, which is the half of the grammar this is about: `is:archived`
  // opens the archive by NAMING it, whatever a caller's scope says, so the
  // operator could never have shown this hole.
  const reading = createRoot(() =>
    createNarrowing({
      derived: () => FINISHED,
      text: () => "#home",
      all: () => ({ kind: "tree", rows }),
      // Every root of this pile is done, so the reader who hides finished work
      // is looking at an empty page — with two matches behind it.
      visible: () => ({ kind: "tree", rows: withoutDone(rows) }),
      today: () => TODAY,
    })
  )
  expect(treeRows(reading)).toEqual([])
  expect(reading.shown()).toBe(0)
  expect(reading.hiddenAsDone()).toBe(2)
})

/**
 * The flat pages answer NO about the archive — pinned here, where the arms are.
 *
 * `showsArchived`'s `day` and `agenda` arms are `false` because the walk those
 * pages are built from leaves the archive out (`@olai/format`'s `dates.ts`), so
 * the format can no longer produce a day group under an `Archive.olai` heading
 * — which is exactly why the fixture below is built BY HAND. Handed the page
 * the old rule would have drawn, the arms still refuse to widen the matcher's
 * scope: the archive is out of the reading because a page's own rows are not a
 * licence to search the directory's, and the row that survived the format is
 * not selected.
 *
 * Without this, both arms are unfalsifiable from outside — every real day and
 * agenda now draws no archived row, so a regression that restored the scan
 * (`drawn.groups.some(fromArchive)`) would go unnoticed until somebody typed a
 * word on a page nobody can build any more.
 */
const putAwayOnADay = (): DayGroup => {
  const shims = zoom(derived, "shims")
  if (shims.kind !== "node") throw new Error("the fixture's archive lost `shims`")
  return {
    file: "Archive.olai",
    nodes: [{ ...shims, occasion: "date", date: "2026-08-14" }],
  }
}

test("a day handed an archived row still does not widen the scope", () => {
  const drawn: Drawn = { kind: "day", groups: [putAwayOnADay()], notes: [] }
  const reading = narrowing(drawn, "shims")
  expect(reading.shown()).toBe(0)
  expect(datedIds(reading.drawn())).toEqual([])
  // The operator is the door that still opens: it names the archive, so it does
  // not need the page's permission.
  expect(narrowing(drawn, "is:archived").shown()).toBe(1)
})

test("the agenda handed one does not either, in any of its three sections", () => {
  const group = putAwayOnADay()
  const sections: ReadonlyArray<Agenda> = [
    { overdue: [group], today: [], upcoming: [] },
    { overdue: [], today: [group], upcoming: [] },
    { overdue: [], today: [], upcoming: [{ date: "2026-08-14", groups: [group] }] },
  ]
  for (const agenda of sections) {
    const reading = narrowing({ kind: "agenda", agenda }, "shims")
    expect(reading.shown()).toBe(0)
    expect(datedIds(reading.drawn())).toEqual([])
  }
})
