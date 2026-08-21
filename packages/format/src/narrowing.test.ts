/**
 * WHAT A FILTER SELECTS ON A PAGE — and the PARITY that lets it be trusted.
 *
 * Two things are asserted here and they are different in kind.
 *
 * **That the page-scoped answer is the whole-set answer, on this page.** The
 * narrowing used to be a search of the DIRECTORY that a page then pruned; it is
 * a reading of the PAGE now, and the whole claim of
 * docs/brainstorming/filter-rides-the-page.md is that a reader cannot tell the
 * difference. So the oracle is the reference matcher: for every page and every
 * query, the page narrowed by what `narrowedIn` selected must be the same page,
 * row for row, as the page narrowed by what `matching` selected over the whole
 * set — and the counts a bar prints off it must be the same numbers. That is
 * the rule docs/search.md already states for every second producer of one
 * answer, read for the one change where the first producer is being deleted.
 *
 * **And the decisions that are this reading's own**: which records of a page a
 * query may take away, whether what was put away may match, and that a node
 * drawn twice is answered once.
 *
 * **It survives the wire**, like every other reading that crosses one: encoded,
 * put through JSON, decoded, compared. A field dropped by an encoder is not
 * hypothetical (docs/brainstorming/surface-mcp-positions.md).
 */

import { expect, test } from "bun:test"
import { Schema } from "effect"

import { addressOf } from "./address.ts"
import { type Agenda, keepingOwed, owedIn } from "./agenda.ts"
import { type DayGroup, datedIn } from "./dates.ts"
import { derive, type Row } from "./derive.ts"
import type { Face } from "./document.ts"
import {
  keeping,
  keepingDated,
  matchedIn,
  matching,
  parseFilter,
  rowsIn,
  type Selected,
} from "./filter.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import {
  NarrowingAnswer,
  narrowedIn,
  narrowingOf,
  sameNarrowing,
  showsPutAway,
} from "./narrowing.ts"
import { type PageRequest, type Shown, shownOf } from "./page.ts"
import type { BrokenFile } from "./set.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the doors","desc":"walnut, or birch","date":"2026-08-10","todo":true}`,
  `{"id":"hinges","parent":"kitchen","ord":"a1","title":"pick the door hinges","done":"2026-08-02"}`,
  // A MIRROR of a node that lives in another outline, which is the case that
  // makes a `file:`-scoped matcher wrong and this walk right: the row is drawn
  // here and the record is over there.
  `{"id":"herbs-here","parent":"kitchen","ord":"a2","mirror":"herbs"}`,
].join("\n")

const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed doors","date":"2026-08-01","todo":true}`,
  `{"id":"shed","parent":"garden","ord":"a1","title":"the shed door"}`,
].join("\n")

const TRASH = [
  `{"id":"old","ord":"a0","title":"the old door"}`,
  `{"id":"pulls","parent":"old","ord":"a0","title":"the old pulls"}`,
].join("\n")

/** A leftover `Archive.olai` — not the trash and not live work either, which is
 *  a rule the matcher holds and this reading inherits rather than restates. */
const LEFTOVER = `{"id":"attic","ord":"a0","title":"the attic door"}`

const SET = derive(nodesOfFiles({
  "house.olai": HOUSE,
  "garden.olai": GARDEN,
  "_olai/Trash.olai": TRASH,
  "Archive.olai": LEFTOVER,
}))

const TODAY = "2026-08-10"

const FILES = ["Archive.olai", "_olai/Trash.olai", "garden.olai", "house.olai"]
const facesOf = (paths: ReadonlyArray<string>): ReadonlyArray<Face> =>
  paths.map((path) => ({ path, title: path, links: [], tags: [] } as unknown as Face))
const FACES = facesOf(FILES)
const READABLE: ReadonlyArray<BrokenFile> = []

const at = (path: string): PageRequest => ({ kind: "at", address: addressOf(path, null)! })
const node = (id: string): PageRequest => ({ kind: "at", address: addressOf("", id)! })

/** Every page this fixture can be read as — the sweep the parity claim runs
 *  over. Named so a failure says which page it was about. */
const PAGES: ReadonlyArray<readonly [string, PageRequest]> = [
  ["an outline", at("house.olai")],
  ["another outline", at("garden.olai")],
  ["a zoomed node", node("kitchen")],
  ["a zoom onto an archived node", node("old")],
  ["a leftover archive", at("Archive.olai")],
  ["a day", { kind: "day", date: "2026-08-10" }],
  ["the agenda", { kind: "agenda", today: TODAY }],
  ["the trash", { kind: "trash" }],
]

/** The queries, chosen so each reaches a different part of the grammar: words
 *  that hit titles across two files, a word that only a NOTE carries, a clause
 *  that names no word at all, one that names the archive, and one that selects
 *  nothing. */
const QUERIES = ["door", "walnut", "is:done", "is:todo", "is:trashed door", "zzz", "#home"]

const shownAt = (request: PageRequest): Shown => shownOf(SET, FACES, READABLE, request)

const selectedBy = (matches: NarrowingAnswer["matches"]): Selected =>
  new Map(matches.map((one) => [one.id as string, one]))

/**
 * WHAT THE REFERENCE MATCHER SELECTS on this page — every node in the SET the
 * query picks, which is the answer the door this replaced gave, with the same
 * archive question asked of the same page.
 */
const oracle = (shows: Shown, text: string): Selected =>
  new Map(
    matching(SET, parseFilter(text, TODAY), { trashed: showsPutAway(shows) })
      .map(({ at: found }) => [found.node.id, {}]),
  )

/**
 * THE PAGE, NARROWED — the shape a reader actually sees, which is what the
 * parity is about: two answers that prune one page to the same rows are the
 * same answer, whatever else is in them.
 *
 * The format's own prunes, never a rule invented here, for the reason
 * `@olai/web`'s `filter/drawn.ts` gives from the other side: a walk written in
 * a test would be free to disagree with the very pruning it is checking.
 */
const narrowedPage = (shows: Shown, selected: Selected): unknown => {
  switch (shows.kind) {
    case "outline":
      return { rows: idsOfRows(keeping(shows.rows, selected)), places: rowsIn(shows.rows) }
    case "node":
      return shows.zoomed.kind === "node"
        ? {
          rows: idsOfRows(keeping(shows.zoomed.children, selected)),
          places: rowsIn(shows.zoomed.children),
        }
        : { rows: [], places: 0 }
    case "day":
      return {
        rows: idsOfGroups(keepingDated(shows.groups, selected)),
        places: datedIn(shows.groups),
      }
    case "agenda":
      return {
        rows: idsOfAgenda(keepingOwed(shows.agenda, selected)),
        places: owedIn(shows.agenda),
      }
    case "trash":
      return {
        rows: shows.groups.map((group) => [group.file, idsOfRows(keeping(group.rows, selected))]),
        places: shows.groups.reduce((total, group) => total + rowsIn(group.rows), 0),
      }
    case "document":
    case "broken":
    case "nothing":
      return { rows: [], places: 0 }
  }
}

/** ...and the numerator beside it, which is the other half of "3 of 41" and the
 *  number a wrong scope would move without moving a row. */
const matchesOn = (shows: Shown, selected: Selected): number => {
  switch (shows.kind) {
    case "outline":
      return matchedIn(shows.rows, selected)
    case "node":
      return shows.zoomed.kind === "node" ? matchedIn(shows.zoomed.children, selected) : 0
    case "day":
      return datedIn(keepingDated(shows.groups, selected))
    case "agenda":
      return owedIn(keepingOwed(shows.agenda, selected))
    case "trash":
      return shows.groups.reduce(
        (total, group) => total + matchedIn(group.rows, selected),
        0,
      )
    case "document":
    case "broken":
    case "nothing":
      return 0
  }
}

const idsOfRows = (rows: ReadonlyArray<Row>): unknown =>
  rows.map((row) => [row.key, idsOfRows(row.children)])
const idsOfGroups = (groups: ReadonlyArray<DayGroup>): unknown =>
  groups.map((group) => [group.file, group.nodes.map((entry) => entry.shows.node.id)])
const idsOfAgenda = (agenda: Agenda): unknown => [
  agenda.overdue.map((day) => [day.date, idsOfGroups(day.groups)]),
  idsOfGroups(agenda.today),
  agenda.upcoming.map((day) => [day.date, idsOfGroups(day.groups)]),
]

// ── the parity ─────────────────────────────────────────────────────────

for (const [what, request] of PAGES) {
  for (const text of QUERIES) {
    test(`${what}, filtered by \`${text}\`, is the page the reference matcher leaves`, () => {
      const shows = shownAt(request)
      const mine = selectedBy(narrowedIn(SET, shows, parseFilter(text, TODAY)))
      const theirs = oracle(shows, text)
      expect(narrowedPage(shows, mine)).toEqual(narrowedPage(shows, theirs))
      expect(matchesOn(shows, mine)).toBe(matchesOn(shows, theirs))
    })
  }
}

// ── and what is this reading's own ─────────────────────────────────────

const idsAt = (request: PageRequest, text: string): ReadonlyArray<string> =>
  narrowedIn(SET, shownAt(request), parseFilter(text, TODAY)).map((one) => one.id as string)

test("a node this page does not draw is not in the answer, however well it matches", () => {
  // `shed` holds the word and lives in the other outline. That is the whole
  // change: the walk never reaches it, where the door this replaced walked the
  // vault to hand it over for the page to drop again.
  expect(idsAt(at("house.olai"), "door")).not.toContain("shed")
  expect(idsAt(at("garden.olai"), "door")).toContain("shed")
})

test("a MIRROR is answered by the node it shows, in the file that node lives in", () => {
  // The case that makes a `file:`-scoped matcher wrong: `herbs` is drawn on
  // `house.olai` as a placement and its record is in `garden.olai`, so an
  // answer scoped by the page's FILE would lose the row it is made of.
  expect(idsAt(at("house.olai"), "herb")).toEqual(["herbs"])
})

test("a node drawn twice is answered once", () => {
  // A placement is not a node. `herbs` is drawn under `garden` and again as the
  // mirror on `house.olai`; the agenda reaches both files at once, and what
  // comes back is a set of ids a page looks itself up in.
  const answered = idsAt({ kind: "agenda", today: TODAY }, "herb")
  expect(answered).toEqual(["herbs"])
})

test("what was put away is out of a live page and IN on the trash", () => {
  // The grammar's own door is still the grammar's, and what it opens is a
  // corner of the set a live outline is not in.
  expect(idsAt(at("house.olai"), "is:trashed door")).toEqual([])
  // The trash IS the archive: a matcher applying the default there would take
  // every row off the screen and leave nothing to read the absence by.
  expect(idsAt({ kind: "trash" }, "door")).toEqual(["old"])
  // ...and so is a zoom onto a node somebody put away, which is where an
  // `is:trashed` hit lands when it is clicked.
  expect(idsAt(node("old"), "pulls")).toEqual(["pulls"])
})

test("a leftover archive is orphaned from every query, the way it always was", () => {
  // Not trash, and not live work either — the rule lives in the matcher and
  // this reading inherits it rather than restating it.
  expect(idsAt(at("Archive.olai"), "door")).toEqual([])
  expect(idsAt(at("Archive.olai"), "is:trashed door")).toEqual([])
})

test("only what a PRUNE can take away is a candidate", () => {
  // A zoomed page draws its heading, its crumbs and its backlinks, and a filter
  // has never taken one of those away — so a match found only there would be an
  // id nothing looks up. `kitchen` is the heading of its own zoom and holds the
  // tag; the rows under it do not.
  expect(idsAt(node("kitchen"), "#home")).toEqual([])
  // ...and on the outline that DRAWS `kitchen` as a row, it is selected.
  expect(idsAt(at("house.olai"), "#home")).toEqual(["kitchen"])
})

test("an empty box and a query the grammar refused both select nothing", () => {
  expect(idsAt(at("house.olai"), "   ")).toEqual([])
  expect(idsAt(at("house.olai"), "is:open")).toEqual([])
})

// ── the envelope, and the wire ─────────────────────────────────────────

test("the answer carries the words it answers, and survives the wire", () => {
  const answer = narrowingOf(SET, FACES, READABLE, {
    page: at("house.olai"),
    text: "door",
  }, TODAY)
  expect(answer.text).toBe("door")
  const encoded = Schema.encodeUnknownSync(NarrowingAnswer)(answer)
  const back = Schema.decodeUnknownSync(NarrowingAnswer)(JSON.parse(JSON.stringify(encoded)))
  expect(back).toEqual(answer)
  expect(sameNarrowing(back, answer)).toBe(true)
})

test("two answers that select the same nodes for the same reasons are the same", () => {
  // What keeps a revision that moved no match off the wire — the whole of the
  // fix, in the line the server binds as this member's `isEqual`.
  const ask = (text: string) =>
    narrowingOf(SET, FACES, READABLE, { page: at("house.olai"), text }, TODAY)
  expect(sameNarrowing(ask("door"), ask("door"))).toBe(true)
  expect(sameNarrowing(ask("door"), ask("hinges"))).toBe(false)
})
