/**
 * The page's filter, as one reading.
 *
 * Everything a filtered page needs is derived from ONE string — the `?q=` on
 * the address (`../routes.ts`) — and it is derived here rather than in the
 * components, so the bar's count, the rows the page draws and the folds a tree
 * suspends cannot come to three different conclusions about the same query.
 *
 * THE MATCHING IS NOT HERE. `@olai/format`'s `parseFilter` / `matching` is what
 * decides which nodes a query selects, and it is the same function an agent's
 * `search_nodes` is gated by — one matcher, four callers, argued in that file's
 * header and in docs/brainstorming/filter-in-place.md. This file decides only
 * what to do with the answer.
 *
 * WHATEVER THE PAGE IS. The filter used to be the two tree pages' and is now
 * every page that draws nodes (`../page.ts`'s {@link Drawn}), which cost this
 * file one switch rather than a second reading: the ids a query selects are the
 * same set on any page, and what differs is only the shape they are tested
 * against — a tree keeps the ancestors that lead to a match, a day and the
 * agenda are flat rows that arrive carrying their own ancestry, the trash is a
 * tree per archive.
 *
 * THE ARCHIVE IS ASKED FOR, ONCE, HERE — and it is the one thing this file
 * tells the matcher about the question rather than about the answer. Archived
 * nodes are out of every reading unless a query says `is:archived`
 * (docs/search.md), because the doors that rule is written for are searching
 * the DIRECTORY. This door is not: it tests the rows in front of somebody, and
 * some of the pages it runs on draw archived nodes for reasons of their own —
 * the trash IS the archive, and a day and the agenda collect dated nodes
 * wherever they were filed. Asked of the page's OWN ROWS ({@link showsArchived})
 * rather than of its kind, so it cannot come to disagree with what is on
 * screen, and so the commonest page — an outline, which never draws one —
 * does not scan the one file in a directory that only ever grows.
 *
 * The ORDER of the two prunings is the decision worth naming: done-hidden goes
 * FIRST. It is a standing claim about the reader ("I do not want to look at
 * finished work"); the filter is a question about the page. So the filter reads
 * what the preference left, and `is:done` under a done-hiding preference draws
 * nothing — which is said out loud ({@link Narrowing.hiddenAsDone}) rather than
 * special-cased away. Letting an explicit `is:done` override the preference
 * would make the preference mean two things depending on what else was typed.
 */

import type { Derived, Refusal, Row } from "@olai/format"
import {
  datedIn,
  isArchived,
  keeping,
  keepingDated,
  keepingOwed,
  matchedIn,
  matching,
  owedIn,
  parseFilter,
  shownRecord,
} from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import type { Drawn, TrashGroup } from "../page.ts"

/** What an unfiltered page has selected — ONE set, shared by every reading of
 *  it. A fresh `new Set()` per read would be a new value every frame, and every
 *  row of the tree memoises against this one. */
export const NOTHING_MATCHED: ReadonlySet<string> = new Set()

/** What a filtered page knows about itself. */
export interface Narrowing {
  /** What was typed, verbatim — the value in the box. */
  readonly text: Accessor<string>
  /** Is there a filter at all? An empty box is not a filter; a box holding a
   *  query the grammar refused IS one, and it selects nothing. */
  readonly active: Accessor<boolean>
  /** What the grammar could not read, in its own words — empty for every query
   *  it could. Lifted off the parsed value rather than handed out with it: the
   *  bar wants the sentences, and nothing in this client has any business
   *  reading a query's terms apart from the matcher that owns them. */
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  /** The node ids the query selects, across the whole set. Tested against what
   *  the page draws, which is what scopes it to the page. */
  readonly matched: Accessor<ReadonlySet<string>>
  /** What the page actually draws: done-hidden first, then narrowed. */
  readonly drawn: Accessor<Drawn>
  /** How many drawn rows are matches, and how many rows there are in all —
   *  "3 of 41", the honest version. Both are PLACES: a node drawn twice is two
   *  rows, and the reader is counting rows. */
  readonly shown: Accessor<number>
  readonly total: Accessor<number>
  /** Matches the done-preference is holding back. Zero unless finished work is
   *  hidden, and the reason `is:done` looking empty is a sentence rather than a
   *  mystery. */
  readonly hiddenAsDone: Accessor<number>
}

/**
 * The reading, over the app's three inputs: the set's derivation, what the open
 * page draws BEFORE the done preference is applied, and the same after it.
 *
 * Both are handed in rather than computed here because the app already has them
 * (`../App.tsx` composes the page and applies `visible`), and a second
 * `drawnBy` would be a second answer to what page is open.
 */
export const createNarrowing = (source: {
  readonly derived: Accessor<Derived | undefined>
  readonly text: Accessor<string>
  /** What the page draws with nothing hidden — what the count of held-back
   *  matches is measured against. */
  readonly all: Accessor<Drawn>
  /** The same, with this reader's preference applied. */
  readonly visible: Accessor<Drawn>
  /** What day it is here, from the tab's one clock (`../clock.ts`) — what the
   *  grammar's relative words count from. An ACCESSOR, because that clock moves
   *  at midnight and a page left open on `date:today` should be narrowed to the
   *  day the reader is looking at rather than the one they opened it on. */
  readonly today: Accessor<string>
}): Narrowing => {
  const query = createMemo(() => parseFilter(source.text(), source.today()))
  const active = createMemo(() => query().kind !== "nothing")

  const matched = createMemo(() => {
    const indexes = source.derived()
    if (indexes === undefined || !active()) return NOTHING_MATCHED
    // The one thing the matcher is told about the QUESTION rather than asked
    // about the answer — the file header says why, and why it is read off the
    // page rather than off its kind.
    const scope = { archived: showsArchived(source.visible()) }
    return new Set(matching(indexes, query(), scope).map(({ at }) => at.node.id))
  })

  // The ONE guard that is load-bearing: narrowing by an empty set is an empty
  // page, and an unfiltered page draws the whole one. Every count below is
  // honestly zero without a guard, so none of them has one.
  const drawn = createMemo(() =>
    active() ? narrowed(source.visible(), matched()) : source.visible()
  )

  // Guarded like the count beside it, and for the same reason: an unfiltered
  // page would otherwise walk everything it draws, on every revision the store
  // publishes, to arrive at a zero the bar is not drawing.
  const shown = createMemo(() => (active() ? matchesIn(drawn(), matched()) : 0))

  return {
    text: source.text,
    active,
    refusals: createMemo(() => {
      const asked = query()
      return asked.kind === "refused" ? asked.refusals : []
    }),
    matched,
    drawn,
    shown,
    // Only ever READ beside the count, which is drawn only while a filter is
    // on — so an unfiltered page does not pay a walk of everything it draws, on
    // every revision the store publishes, for a number nobody is looking at.
    total: createMemo(() => (active() ? placesIn(source.visible()) : 0)),
    // The difference between what the query selects on this page and what
    // survived the preference. Measured over the page's own rows rather than
    // over the set, because "4 done matches are hidden" is a claim about what
    // is not on this screen.
    //
    // The identity check is exact rather than an optimisation that hopes: the
    // done preference returns THE SAME VALUE when it is hiding nothing
    // (`../App.tsx` hands the same `Drawn` through), so two identical readings
    // cannot differ by a match. It is also how the three pages the preference
    // does not touch answer zero without saying so twice.
    hiddenAsDone: createMemo(() =>
      source.all() === source.visible()
        ? 0
        : matchesIn(source.all(), matched()) - shown()
    ),
  }
}

/**
 * The same page with everything that did not match taken out of it — one arm
 * per shape, and each arm is the format's own prune rather than a rule invented
 * here (`keeping`, `keepingDated`, `keepingOwed`).
 *
 * The trash is the one composition: an archive is a tree, so its rows are
 * `keeping`'s, and an archive left with nothing goes the way a day's group does
 * — a heading over no rows would say that archive holds something the query
 * did not find.
 */
const narrowed = (drawn: Drawn, matched: ReadonlySet<string>): Drawn => {
  switch (drawn.kind) {
    case "tree":
      return { kind: "tree", rows: keeping(drawn.rows, matched) }
    // THE NOTE GOES WITH THE ROWS THAT DID NOT MATCH, and it is decided here
    // rather than in the page for the reason everything else about a narrowed
    // page is: a note is a DOCUMENT — prose, which is exactly the page kind
    // that takes no filter (`../routes.ts`) — so it can never be a match, and
    // a day answering a query with somebody's prose plus no rows would be
    // answering something nobody asked.
    case "day":
      return { kind: "day", groups: keepingDated(drawn.groups, matched), notes: [] }
    case "agenda":
      return { kind: "agenda", agenda: keepingOwed(drawn.agenda, matched) }
    case "trash":
      return { ...drawn, groups: keepingArchives(drawn.groups, matched) }
    case "none":
      return drawn
  }
}

/**
 * Is the page in front of the reader drawing anything that was PUT AWAY?
 *
 * Asked of the page's own rows rather than of its KIND, so it cannot come to
 * disagree with what is on screen. A day and the agenda collect dated nodes
 * wherever they were filed, archive included (`@olai/format`'s `dates.ts` says
 * why, and `agenda.ts` follows it); the trash is made of archives; a tree page
 * draws one outline, and an archive's own address opens the trash instead
 * (`../page.ts`) — except by a zoom onto an archived node, which answers for
 * itself here rather than being ruled out.
 *
 * The GROUPS and the ROOTS, never a walk: a heading names its file, and a row
 * shows a record that names one. A pile nested under a live row is not reached,
 * and that is the honest bound — this runs per keystroke and the answer it
 * feeds is a default, not a permission.
 */
const showsArchived = (drawn: Drawn): boolean => {
  switch (drawn.kind) {
    case "tree":
      return drawn.rows.some((row) => isArchived(shownRecord(row).file))
    case "day":
      return drawn.groups.some(fromArchive)
    case "agenda":
      return drawn.agenda.overdue.some(fromArchive) ||
        drawn.agenda.today.some(fromArchive) ||
        drawn.agenda.upcoming.some((day) => day.groups.some(fromArchive))
    case "trash":
      return drawn.groups.some(fromArchive)
    case "none":
      return false
  }
}

/** A heading that names an archive — the one thing a day group and a trash
 *  group have in common, which is the file they are drawn under. */
const fromArchive = (group: { readonly file: string }): boolean =>
  isArchived(group.file)

const keepingArchives = (
  groups: ReadonlyArray<TrashGroup>,
  matched: ReadonlySet<string>,
): ReadonlyArray<TrashGroup> =>
  groups.flatMap((group) => {
    const rows = keeping(group.rows, matched)
    return rows.length === 0 ? [] : [{ ...group, rows }]
  })

/** How many PLACES a page draws — the second number in "3 of 41". */
const placesIn = (drawn: Drawn): number => {
  switch (drawn.kind) {
    case "tree":
      return countRows(drawn.rows)
    case "day":
      return datedIn(drawn.groups)
    case "agenda":
      return owedIn(drawn.agenda)
    case "trash":
      return drawn.groups.reduce((total, group) => total + countRows(group.rows), 0)
    case "none":
      return 0
  }
}

/**
 * How many of those places the query SELECTED — the first number.
 *
 * Asked of the pruned page it is the count of what is on screen, and asked of
 * the unpruned one it is what the done preference held back; the membership
 * test is what lets one function answer both. On a tree the two numbers differ
 * for a third reason — a kept ancestor is drawn and is not a match — which is
 * the distinction the whole feature is made of.
 */
const matchesIn = (drawn: Drawn, matched: ReadonlySet<string>): number => {
  switch (drawn.kind) {
    case "tree":
      return matchedIn(drawn.rows, matched)
    // The prune, counted — never a second reading of which rows a set of ids
    // selects. A count written here would be free to disagree with the very
    // pruning it is counting, which is the drift `datedIn` was moved down to
    // `@olai/format` to prevent one layer lower.
    case "day":
      return datedIn(keepingDated(drawn.groups, matched))
    case "agenda":
      return owedIn(keepingOwed(drawn.agenda, matched))
    case "trash":
      return drawn.groups.reduce(
        (total, group) => total + matchedIn(group.rows, matched),
        0,
      )
    case "none":
      return 0
  }
}

const countRows = (rows: ReadonlyArray<Row>): number =>
  rows.reduce((total, row) => total + 1 + countRows(row.children), 0)
