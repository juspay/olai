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
 * file computes from its inputs, and that is exactly what a fixed query asks.
 *
 * WHERE THE MATCHES COME FROM, since `filter-rides-the-page`: the server, and
 * here from {@link answered} — the same `@olai/format` reading the server runs
 * (`@olai/ops`' `Query.narrowing`), over the same page. So every case builds the
 * `Shown` the server would have computed and derives what a browser DRAWS of it
 * (`../page.ts`'s `drawnBy`), which is the order the app is in; the archive
 * cases still fail if the scope decision regresses, and what they no longer
 * reach is the wiring in `../pane/PageView.tsx`, which is a browser's fact and
 * is pinned in the suite that has one.
 *
 * The three states a round trip added are cases of their own at the end of this
 * file: nothing answered yet, an answer to the query before, and a query the
 * grammar refused (which is never asked at all).
 */

import {
  agendaOf,
  type Agenda,
  type DayGroup,
  datedOn,
  derive,
  nodesOf,
  parseFilter,
  type Row,
  rowsIn,
  rowsOf,
  type Shown,
  withoutDone,
  zoom,
} from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { only } from "../narrow.ts"
import { type Drawn, drawnBy } from "../page.ts"
import { answered } from "./answered.testlib.ts"
import type { Matches } from "./matches.ts"
import { createNarrowing, type Narrowing } from "./narrowing.ts"

const derived = derive(nodesOfFiles({
  "house.org": [
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
  "_olai/Trash.org": [
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

/** What the server would say about this query on this page
 *  (`./answered.testlib.ts`, shared with `./why.test.ts`). */
const said = (shows: Shown, text: string, over = derived): Matches =>
  answered(over, shows, text, TODAY)

/** The page, at one query and one preference — the same inputs the pane hands
 *  over. What a browser DRAWS of a reading is `drawnBy`'s, so the fixture is the
 *  server's value and the two prunings run over what this client makes of it.
 *  The done preference reaches the TREE and nothing else, which is where it
 *  reaches in the app. */
const narrowing = (shows: Shown, text: string, hideDone = false): Narrowing => {
  const drawn = drawnBy(shows)
  return createRoot(() =>
    createNarrowing({
      query: () => parseFilter(text, TODAY),
      text: () => text,
      all: () => drawn,
      visible: () =>
        hideDone && drawn.kind === "tree"
          ? { kind: "tree", rows: withoutDone(drawn.rows) }
          : drawn,
      matched: () => said(shows, text),
      answering: () => text.trim(),
    })
  )
}

const house: Shown = {
  kind: "outline",
  file: "house.org",
  rows: rowsOf(derived, "house.org"),
}
const tree: Drawn = drawnBy(house)
const page = (text: string, hideDone = false): Narrowing =>
  narrowing(house, text, hideDone)

test("an empty box is not a filter, and the page is the page", () => {
  const reading = page("")
  expect(reading.active()).toBe(false)
  expect(treeRows(reading)).toHaveLength(1)
  // The counts are only ever drawn beside an active filter, so an unfiltered
  // page does not walk its own tree to produce them.
  expect(reading.counts().held).toBe(0)
  expect(reading.counts().shown).toBe(0)
})

test("a filtered page counts the rows it draws, of the rows it holds", () => {
  const reading = page("hinges")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(5)
})

test("a query keeps its matches and the ancestors that lead to them", () => {
  const reading = page("hinges")
  expect(reading.active()).toBe(true)
  expect(reading.counts().shown).toBe(1)
  // `kitchen` → `install` → `hinges`: one match, two ancestors kept as the
  // context that makes a bare title mean something.
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
})

// The preference is a standing claim about the READER; the filter is a question
// about the page. So the preference goes first — and the consequence is said
// rather than special-cased.
test("finished work is hidden before the query is asked, and the difference is reported", () => {
  const showing = page("#home")
  expect(showing.counts().shown).toBe(3)
  expect(showing.counts().hiddenAsDone).toBe(0)

  // `demo` carries `#home` and is done: it is not on the page to be matched.
  const hiding = page("#home", true)
  expect(hiding.counts().shown).toBe(2)
  expect(hiding.counts().hiddenAsDone).toBe(1)
})

/**
 * THE DENOMINATOR IS WHAT THE PAGE HOLDS, and it is the same number whichever
 * way the preference is set — which is the whole of the arithmetic fix.
 *
 * The count used to be measured against what the preference LEFT, so the two
 * numbers in "2 of 4 — 1 match hidden as done" came out of two different sets:
 * the held-back match was held back precisely because it was not among the 4.
 * Counted over what the page holds, the parts are parts of one whole — matches
 * drawn, plus matches held back, plus the rows that did not match — and a
 * reader who adds them up is not lied to.
 */
test("the denominator does not move when finished work is hidden", () => {
  expect(page("#home").counts().held).toBe(5)

  const hiding = page("#home", true)
  // Two drawn and one held back, inside the five the page holds — the whole
  // record at once, because the claim is about how the three numbers sit
  // together and asserting them one at a time is what let them drift apart.
  expect(hiding.counts()).toEqual({ shown: 2, held: 5, hiddenAsDone: 1 })
  // The tree itself is down to four rows, and four is exactly the number the
  // denominator used to be and must not be again.
  expect(rowsIn(treeRows(hiding))).toBe(4)
})

test("`is:done` under a reader who hides finished work says why it found nothing", () => {
  const hiding = page("is:done", true)
  expect(treeRows(hiding)).toEqual([])
  expect(hiding.counts().shown).toBe(0)
  expect(hiding.counts().hiddenAsDone).toBe(1)
  // Nothing drawn, and still the honest denominator: the page holds five rows,
  // and the query is what emptied it.
  expect(hiding.counts().held).toBe(5)
})

// The one door that parses for itself gets the relative words from the same
// grammar, counted from the tab's own clock — which is why the day is an input
// of this reading rather than something `parseFilter` reaches for. `demo` was
// finished on the 3rd of August, the month the page is being read in.
test("a relative date is counted from the day the page is being read on", () => {
  const reading = page("date:this-month")
  expect(reading.counts().shown).toBe(3)
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
const dayOf = (date: string, notes: ReadonlyArray<string> = []): Shown => ({
  kind: "day",
  date,
  groups: datedOn(derived, date),
  notes,
})

// A day's rows are FLAT and each arrives with its own ancestry, so narrowing
// one keeps nothing as context: what is left is exactly what matched.
test("a day keeps the rows that matched, and drops the outline that has none", () => {
  const whole = dayOf("2026-08-14")
  // `shims` is dated the 14th and was put away, so it is on neither of these
  // pages any more (the test below is the claim; this is the count it changes).
  expect(datedIds(drawnBy(whole))).toEqual(["order", "hinges"])

  const reading = narrowing(whole, "hinges")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(2)
  expect(datedIds(reading.drawn())).toEqual(["hinges"])

  // Nothing on the day matched, so the outline that held both rows goes with
  // them — a heading over no rows would say that file still has something on
  // this day.
  const none = narrowing(whole, "bathroom")
  expect(groupsIn(none.drawn())).toEqual([])
  expect(none.counts().shown).toBe(0)
  expect(none.counts().held).toBe(2)
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
  expect(sought.counts().shown).toBe(0)
  expect(datedIds(sought.drawn())).toEqual([])
  // The operator says the same thing from either side: nothing to select, and
  // nothing for its negation to take away.
  expect(narrowing(whole, "is:trashed").counts().shown).toBe(0)
  expect(datedIds(narrowing(whole, "-is:trashed").drawn()))
    .toEqual(["order", "hinges"])
})

test("the agenda answers the same way, over the dates read forward", () => {
  const forward: Shown = { kind: "agenda", date: TODAY, agenda: agendaOf(derived, TODAY) }
  expect(datedIds(drawnBy(forward))).toEqual(["order", "hinges"])

  expect(narrowing(forward, "shims").counts().shown).toBe(0)
  expect(narrowing(forward, "is:trashed").counts().shown).toBe(0)
  expect(datedIds(narrowing(forward, "-is:trashed").drawn()))
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
  expect(page("shims").counts().shown).toBe(0)
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
const owed: Shown = { kind: "agenda", date: TODAY, agenda }

test("the agenda narrows day by day, and counts every row it draws", () => {
  // Everything dated the 14th slipped, and none of it is finished — except the
  // archived one, which is nowhere on the line now that what was put away is
  // the trash's alone.
  expect(datedIds(drawnBy(owed))).toEqual(["order", "hinges"])

  const reading = narrowing(owed, "is:todo")
  expect(reading.counts().held).toBe(2)
  expect(reading.counts().shown).toBe(1)
  const drawn = reading.drawn()
  // One late DAY left, narrowed to the row that says `todo` — `order` is
  // `doing`, and the archive is not here to be a second anything.
  expect(drawn.kind === "agenda" ? drawn.agenda.overdue.length : -1).toBe(1)
  expect(datedIds(drawn)).toEqual(["hinges"])
})

// ── the trash, where a query would otherwise refuse to look ────────────

const trash: Shown = {
  kind: "trash",
  files: ["_olai/Trash.org"],
  groups: [{ file: "_olai/Trash.org", rows: rowsOf(derived, "_olai/Trash.org") }],
  records: nodesOf(derived, "_olai/Trash.org").length,
}

// The rule this page exists to except: archived nodes are out of every reading
// unless the query says `is:trashed` — and this page IS the archive, so a
// plain word searches what is in front of the reader rather than nothing.
test("a word typed on the trash searches what was put away", () => {
  const reading = narrowing(trash, "grout")
  expect(reading.counts().shown).toBe(1)
  expect(reading.counts().held).toBe(4)
  // The pile's own scaffold is kept as the context that says where it came
  // from — the tree rule, on a tree of archives.
  expect(flat(archiveRows(reading.drawn()))).toEqual(["old-kitchen", "grout"])
})

test("an archive with nothing left is not drawn at all", () => {
  const reading = narrowing(trash, "bathroom")
  expect(archiveRows(reading.drawn())).toEqual([])
  expect(reading.counts().shown).toBe(0)
})

// The operator still means what it means: on the page that is the archive,
// `is:trashed` selects everything and its negation selects nothing.
test("`is:trashed` and its negation still say what they say here", () => {
  expect(narrowing(trash, "is:trashed").counts().shown).toBe(4)
  expect(narrowing(trash, "-is:trashed").counts().shown).toBe(0)
})

// ...and `is:trashed` typed on an outline draws nothing, which is the prune
// rather than the scope: the operator opens the archive by naming it, and the
// page has none of it to keep.
test("`is:trashed` on an outline still draws that outline's nothing", () => {
  const reading = page("is:trashed")
  expect(treeRows(reading)).toEqual([])
  expect(reading.counts().shown).toBe(0)
})

// The OTHER tree, and the reason that arm survived the ruling: `/#<id>` on a
// node somebody put away is a tree whose rows are archived, and it is exactly
// where an `is:trashed` hit lands when a reader clicks it (docs/search.md —
// what was taken away is the default presence, never the reachability). A
// matcher applying the default there would empty a page the reader asked for
// by name.
test("a zoom onto an archived node is searched like the pile it is in", () => {
  const zoomed = zoom(derived, "old-kitchen")
  // Named rather than defaulted to an empty tree: a fixture whose archive stopped
  // holding this node should fail here, not as a mystifying empty page below.
  if (zoomed.kind !== "node") throw new Error(`the archive has no \`old-kitchen\``)
  const inArchive: Shown = { kind: "node", zoomed, backlinks: [] }
  const reading = narrowing(inArchive, "grout")
  expect(flat(treeRows(reading))).toEqual(["grout"])
  expect(reading.counts().shown).toBe(1)
  expect(narrowing(inArchive, "is:trashed").counts().shown).toBe(3)
})

// ── a page a filter has nothing to narrow ──────────────────────────────

test("a page with nothing to narrow counts nothing and stays itself", () => {
  const reading = narrowing({ kind: "nothing", sought: "outline", requested: null }, "hinges")
  expect(reading.drawn()).toEqual({ kind: "none" })
  expect(reading.counts().shown).toBe(0)
  expect(reading.counts().held).toBe(0)
})

const treeRows = (reading: Narrowing): ReadonlyArray<Row> =>
  only(reading.drawn(), "tree")?.rows ?? []

const archiveRows = (drawn: Drawn): ReadonlyArray<Row> =>
  only(drawn, "trash")?.groups.flatMap((group) => group.rows) ?? []

const notesIn = (drawn: Drawn): ReadonlyArray<string> =>
  only(drawn, "day")?.notes ?? []

/** Every group a date-shaped page draws, whichever of the two it is — the
 *  agenda's line read as the one list of groups it is made of. */
const groupsIn = (drawn: Drawn): ReadonlyArray<DayGroup> => {
  const day = only(drawn, "day")
  if (day !== undefined) return day.groups
  const owed = only(drawn, "agenda")?.agenda
  return owed === undefined ? [] : [
    ...owed.overdue.flatMap((gone) => gone.groups),
    ...owed.today,
    ...owed.upcoming.flatMap((ahead) => ahead.groups),
  ]
}

const datedIds = (drawn: Drawn): ReadonlyArray<string> =>
  groupsIn(drawn).flatMap((group) => group.nodes.map((one) => one.shows.node.id))

const flat = (rows: ReadonlyArray<Row>): ReadonlyArray<string> =>
  rows.flatMap((row) => [row.at.node.id, ...flat(row.children)])

// ── the three states a round trip added ────────────────────────────────
//
// What each is, in one line: nothing answered yet, an answer to the query
// before, and a query nobody has to ask. They are the whole of what
// `search-server-side` changed about this reading, and each of them is a page a
// reader can be looking at for a beat.

/** The same page, with the answer handed in by hand — which is what a test of
 *  "what does the page do while it waits" needs and what {@link narrowing}
 *  cannot express, since that one always answers. */
const waiting = (
  shows: Shown,
  text: string,
  said: { matched?: Matches; answering: string | null },
): Narrowing =>
  createRoot(() => {
    const drawn = drawnBy(shows)
    return createNarrowing({
      query: () => parseFilter(text, TODAY),
      text: () => text,
      all: () => drawn,
      visible: () => drawn,
      matched: () => said.matched,
      answering: () => said.answering,
    })
  })

// THE PAGE DOES NOT BLANK. A filter that pruned by "nothing, so far" would
// empty an outline on the first keystroke and fill it back in 200ms later,
// which is the page saying "no matches" about a question nobody has answered.
test("a filter nothing has answered yet draws the whole page, and says so", () => {
  const reading = waiting(house, "hinges", { answering: null })
  expect(reading.active()).toBe(true)
  expect(reading.selected()).toBe(null)
  expect(flat(treeRows(reading))).toEqual(["kitchen", "demo", "order", "install", "hinges"])
  // ...and no row wears a match fact either: `data-match="false"` on every row
  // of an unanswered page is the whole outline claiming to be context.
  expect(reading.answering()).toBe(null)
})

// AND IT DOES NOT FLICKER BACK. Once something has been answered, the rows
// stand as that answer left them while the next one flies — the rows on screen
// are somebody's reading, and re-drawing the whole page between two keystrokes
// is worse than being a question behind.
test("an answer to the query before still narrows, and the page says it is behind", () => {
  const reading = waiting(house, "hinges more", {
    matched: said(house, "hinges"),
    answering: null,
  })
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
  expect(reading.selected()).not.toBe(null)
  // The one thing it must not do is claim the rows are about what is typed.
  expect(reading.answering()).toBe(null)
})

// A QUERY NOBODY HAS TO ASK is answered here, at once: the grammar refused it,
// so it selects nothing, and waiting for a round trip to be told that would be
// a reader typing on past a sentence the app could already say.
test("a refused query answers itself rather than travelling", () => {
  const reading = waiting(house, "is:open", { answering: null })
  expect(reading.active()).toBe(true)
  expect(reading.selected()).not.toBe(null)
  expect(reading.answering()).toBe("is:open")
  expect(treeRows(reading)).toEqual([])
  expect(reading.refusals().map((one) => one.token)).toEqual(["is:open"])
})

// A SPACE IS NOT A QUESTION. The box keeps what somebody typed — a filter is in
// the address, and a trailing space is a keystroke on the way to the next word —
// while what goes on the wire is the words (`./asking.ts` trims, once). If the
// two ever stop agreeing about which string this is, the bar says `filtering…`
// for as long as the space stands and every scenario that waits for the page to
// answer waits forever.
test("a trailing space is the box's, not the question's", () => {
  const reading = waiting(house, "hinges ", {
    matched: said(house, "hinges"),
    answering: "hinges",
  })
  expect(reading.answering()).toBe("hinges")
  expect(flat(treeRows(reading))).toEqual(["kitchen", "install", "hinges"])
})

// ...and so is an empty box, which is not a filter at all.
test("an empty box is answered by the parse, not by the wire", () => {
  const reading = waiting(house, "", { answering: null })
  expect(reading.active()).toBe(false)
  expect(reading.answering()).toBe("")
  expect(rowsIn(treeRows(reading))).toBe(5)
})

// ── the two prunings, on the one page that is inside an archive ────────

/**
 * The done preference must not decide which pages the TRASH is in scope for.
 *
 * A page inside an archive is mostly finished work, so a reader who hides
 * `done` can be looking at one whose every root is hidden. Asked of the page
 * AFTER that pruning, the archive scope read `false` there, the matcher left
 * the whole archive out, and the bar said "0 of 0" with nothing about the
 * matches the preference was holding back — which is the one sentence
 * `hiddenAsDone` exists to make instead of a mystery.
 *
 * IT IS NOW UNREACHABLE BY CONSTRUCTION, and the case is kept for that: which
 * pages draw archived rows is decided on the SERVER, off the page it computed
 * (`@olai/format`'s `showsPutAway`), and a preference of this browser never
 * crosses the wire. The hole this pins was a browser describing its own page to
 * the matcher; nothing describes it any more.
 */
const FINISHED = derive(nodesOfFiles({
  "_olai/Trash.org": [
    `{"id":"old-bath","ord":"a0","title":"bathroom #home","done":"2026-08-01"}`,
    `{"id":"taps","parent":"old-bath","ord":"a0","title":"the taps #home","done":"2026-08-02"}`,
  ].join("\n"),
}))

test("hiding finished work does not take the archive out of a zoom's scope", () => {
  const rows = rowsOf(FINISHED, "_olai/Trash.org")
  // A PLAIN WORD, which is the half of the grammar this is about: `is:trashed`
  // opens the archive by NAMING it, whatever a caller's scope says, so the
  // operator could never have shown this hole.
  const whole: Shown = { kind: "outline", file: "_olai/Trash.org", rows }
  const reading = createRoot(() =>
    createNarrowing({
      query: () => parseFilter("#home", TODAY),
      text: () => "#home",
      all: () => drawnBy(whole),
      // Every root of this pile is done, so the reader who hides finished work
      // is looking at an empty page — with two matches behind it.
      visible: () => ({ kind: "tree", rows: withoutDone(rows) }),
      // ASKED OF THE PAGE THE SERVER COMPUTED, which is the whole reason this
      // can no longer go wrong: a preference of this browser is not on the
      // wire, so nothing a reader hides can reach the scope decision.
      matched: () => said(whole, "#home", FINISHED),
      answering: () => "#home",
    })
  )
  expect(treeRows(reading)).toEqual([])
  expect(reading.counts().shown).toBe(0)
  expect(reading.counts().hiddenAsDone).toBe(2)
})

/**
 * The flat pages answer NO about the archive — pinned here, where the arms are.
 *
 * `showsPutAway`'s `day` and `agenda` arms are `false` because the walk those
 * pages are built from leaves the archive out (`@olai/format`'s `dates.ts`), so
 * the format can no longer produce a day group under an `_olai/Trash.org` heading
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
    file: "_olai/Trash.org",
    nodes: [{ ...shims, occasion: "date", date: "2026-08-14" }],
  }
}

test("a day handed an archived row still does not widen the scope", () => {
  const shows: Shown = { kind: "day", date: "2026-08-14", groups: [putAwayOnADay()], notes: [] }
  const reading = narrowing(shows, "shims")
  expect(reading.counts().shown).toBe(0)
  expect(datedIds(reading.drawn())).toEqual([])
  // The operator is the door that still opens: it names the archive, so it does
  // not need the page's permission.
  expect(narrowing(shows, "is:trashed").counts().shown).toBe(1)
})

test("the agenda handed one does not either, anywhere on its line", () => {
  const group = putAwayOnADay()
  const stretches: ReadonlyArray<Agenda> = [
    { overdue: [{ date: "2026-08-10", groups: [group] }], today: [], upcoming: [] },
    { overdue: [], today: [group], upcoming: [] },
    { overdue: [], today: [], upcoming: [{ date: "2026-08-14", groups: [group] }] },
  ]
  for (const agenda of stretches) {
    const reading = narrowing({ kind: "agenda", date: TODAY, agenda }, "shims")
    expect(reading.counts().shown).toBe(0)
    expect(datedIds(reading.drawn())).toEqual([])
  }
})
