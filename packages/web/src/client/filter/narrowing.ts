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
 * `search_nodes` is gated by — one matcher, five callers, argued in that file's
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
 * the TRASH is the page that draws what was put away — applying the default
 * there would take away every row and leave the reader nothing to read the
 * absence by — and so is a TREE that is a zoom onto an archived node, which is
 * where an `is:archived` hit lands when it is clicked ({@link showsArchived}
 * names both, and the mirror case it cannot rule out). A day and the agenda
 * were two more until 2026-08-17, when the human ruled that what is put away is
 * drawn on the trash and nowhere else (`@olai/format`'s `dates.ts` is where
 * they stopped drawing it), and the question here narrowed with them.
 *
 * The ORDER of the two prunings is the decision worth naming: done-hidden goes
 * FIRST. It is a standing claim about the reader ("I do not want to look at
 * finished work"); the filter is a question about the page. So the filter reads
 * what the preference left, and `is:done` under a done-hiding preference draws
 * nothing — which is said out loud ({@link Narrowing.hiddenAsDone}) rather than
 * special-cased away. Letting an explicit `is:done` override the preference
 * would make the preference mean two things depending on what else was typed.
 */

import type { Derived, Match, Refusal, Selected } from "@olai/format"
import {
  datedIn,
  isArchived,
  keeping,
  keepingDated,
  keepingOwed,
  matchedIn,
  matching,
  needlesOf,
  owedIn,
  parseFilter,
  rowsIn,
  shownRecord,
} from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import type { Drawn, TrashGroup } from "../page.ts"

/** What an unfiltered page has selected — ONE value, shared by every reading of
 *  it. A fresh `new Map()` per read would be a new value every frame, and every
 *  row of the tree memoises against this one. */
export const NOTHING_MATCHED: ReadonlyMap<string, Match> = new Map()

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
  /**
   * The nodes the query selects across the whole set, each against WHY.
   * Tested against what the page draws, which is what scopes it to the page.
   *
   * A MAP where this was a `Set` of ids, and the whole of the change is what a
   * ROW can now ask. The prune only ever asked membership (`Selected`, the
   * question `keeping` takes) — but a row that draws why it is in front of
   * somebody has to know which FIELD carried the hit, since a match found only
   * behind the ¶ draws a title with nothing the query said in it. Keeping a
   * second structure beside the set was the alternative, and two answers to one
   * question are free to disagree by a frame.
   */
  readonly matched: Accessor<ReadonlyMap<string, Match>>
  /** The words the query looks for, folded — what a matched row lights up in
   *  its title (`@olai/format`'s `needlesOf`, and `./lit.ts` for the split).
   *  Empty for a query that named none (`is:done`) and for no query at all. */
  readonly needles: Accessor<ReadonlyArray<string>>
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

  // The one thing the matcher is told about the QUESTION rather than asked
  // about the answer — the file header says why, and why it is read off the
  // page rather than off its kind.
  //
  // ASKED OF THE UNFILTERED PAGE, which is the one thing about it the done
  // preference may not decide. An archive is mostly finished work, so a zoom
  // into one is the page where hiding `done` can take away every row — and
  // asked of what was LEFT, this would answer "no archive here", the matcher
  // would leave the whole archive out, and the bar would say "0 of 0" with
  // nothing about the matches being held back. That sentence
  // ({@link Narrowing.hiddenAsDone}) is measured against `all()`, so what
  // decides its candidate set is measured against `all()` too. Which pages draw
  // archived rows is a fact about the PAGE; what a reader hides is not.
  //
  // A MEMO OF ITS OWN, so the scan below does not track the page. What the page
  // draws is a fresh value on every revision the store publishes and on every
  // navigation — and the whole of what this reading takes from it is a boolean
  // that is constant for four of the five shapes — only a tree is scanned
  // ({@link showsArchived}). Read
  // inline, every one of those frames re-ran the matcher over the entire set to
  // arrive at the same answer.
  const archived = createMemo(() => showsArchived(source.all()))

  const matched = createMemo(() => {
    const indexes = source.derived()
    if (indexes === undefined || !active()) return NOTHING_MATCHED
    return new Map(
      matching(indexes, query(), { archived: archived() }).map((
        { at, match },
      ) => [at.node.id, match]),
    )
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
    // A fact about the QUERY and so a memo of its own: it is read by every
    // matched row on the page, and re-deriving it per row per frame would be
    // the tree walking its own groups once for each of them.
    needles: createMemo(() => needlesOf(query())),
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
    // preference hands back THE SAME VALUE when this reader is not hiding
    // anything at all, and for every page it does not reach
    // (`../settings/done.ts` is exact about which case that is), so two
    // identical readings cannot differ by a match. A reader who IS hiding
    // finished work gets a fresh value whether or not anything was hidden, and
    // then this does the subtraction it exists to do.
    //
    // Guarded like the two counts above, and for their reason: the sentence
    // this feeds is only ever drawn beside an active filter, and a memo is a
    // computation whether or not anybody reads it.
    hiddenAsDone: createMemo(() =>
      !active() || source.all() === source.visible()
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
const narrowed = (drawn: Drawn, matched: Selected): Drawn => {
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
 * TWO PAGES CAN BE, and after the 2026-08-17 ruling that is the whole list. The
 * TRASH is the archive, every group of it — so the answer is its kind and not a
 * scan, because a trash drawing no archived row is a trash drawing no row. And
 * a TREE can be one node's: `/n/<id>` on a node somebody put away, which is
 * exactly where an `is:archived` hit lands when it is clicked (docs/search.md —
 * the ruling took away the default presence, not the reachability). An
 * outline's own tree is a live file, since an archive's address opens the trash
 * instead (`../page.ts`) — with one gap that is not this file's to close: a
 * MIRROR still resolves to a node that was archived after it was placed
 * (`@olai/format`'s `follow`, which the ops layer keeps resolving on purpose),
 * so a placement can draw an archived row on a live page. What that row should
 * be is a ruling about the SET rather than about a filter, and it is filed as
 * one (docs/search.md, docs/brainstorming/editing-web.md's Open).
 *
 * A DAY AND THE AGENDA ANSWER NO, and they answer it by construction rather
 * than by a rule kept here: the walk those pages are built from leaves archived
 * nodes out (`@olai/format`'s `dates.ts`), so there is nothing on either of
 * them for this to find. Left as arms of the switch rather than folded into a
 * default, because a page kind that starts drawing archived rows should have to
 * come back here and say so.
 *
 * The tree arm reads the ROOTS, never a walk: a row shows a record that names a
 * file, and a zoom is inside one file the whole way down. That is the honest
 * bound — this runs per keystroke, and what it feeds is a default rather than a
 * permission.
 *
 * WHAT IT DECIDES IS THE CANDIDATE SET, AND THE COST IS WHOLE-ARCHIVE, which is
 * worth stating rather than leaving to be discovered. `true` puts every
 * archived node in the directory in front of the matcher — not only the ones
 * this page could draw — and the rows that match somewhere else are then
 * dropped by the prune. That is not a leak in this reading, it is how the door
 * already works for every other node: it matches over the SET and narrows by
 * the PAGE ({@link narrowed}), which is what lets a mirror of a node in another
 * file stay drawn where it is placed. What asking buys is the pages that draw
 * NONE — every outline, which is the page somebody types on all day — paying
 * nothing for a file that only ever grows.
 */
const showsArchived = (drawn: Drawn): boolean => {
  switch (drawn.kind) {
    case "trash":
      return true
    case "tree":
      return drawn.rows.some((row) => isArchived(shownRecord(row).file))
    case "day":
    case "agenda":
    case "none":
      return false
  }
}

const keepingArchives = (
  groups: ReadonlyArray<TrashGroup>,
  matched: Selected,
): ReadonlyArray<TrashGroup> =>
  groups.flatMap((group) => {
    const rows = keeping(group.rows, matched)
    return rows.length === 0 ? [] : [{ ...group, rows }]
  })

/** How many PLACES a page draws — the second number in "3 of 41". */
const placesIn = (drawn: Drawn): number => {
  switch (drawn.kind) {
    case "tree":
      return rowsIn(drawn.rows)
    case "day":
      return datedIn(drawn.groups)
    case "agenda":
      return owedIn(drawn.agenda)
    case "trash":
      return drawn.groups.reduce((total, group) => total + rowsIn(group.rows), 0)
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
const matchesIn = (drawn: Drawn, matched: Selected): number => {
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
