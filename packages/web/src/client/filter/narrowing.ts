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
 * THE TRASH IS ASKED FOR, ONCE, HERE — and it is the one thing this file
 * tells the matcher about the question rather than about the answer. Archived
 * nodes are out of every reading unless a query says `is:trashed`
 * (docs/search.md), because the doors that rule is written for are searching
 * the DIRECTORY. This door is not: it tests the rows in front of somebody, and
 * the TRASH is the page that draws what was put away — applying the default
 * there would take away every row and leave the reader nothing to read the
 * absence by — and so is a TREE that is a zoom onto an archived node, which is
 * where an `is:trashed` hit lands when it is clicked (`./drawn.ts`'s
 * {@link showsTrashed} names both, and the mirror case it cannot rule out).
 * A day and the agenda were two more until 2026-08-17, when the human ruled
 * that what is put away is drawn on the trash and nowhere else
 * (`@olai/format`'s `dates.ts` is where they stopped drawing it), and the
 * question here narrowed with them.
 *
 * The ORDER of the two prunings is the decision worth naming: done-hidden goes
 * FIRST. It is a standing claim about the reader ("I do not want to look at
 * finished work"); the filter is a question about the page. So the filter reads
 * what the preference left, and `is:done` under a done-hiding preference draws
 * nothing — which is said out loud ({@link Counts.hiddenAsDone}) rather than
 * special-cased away. Letting an explicit `is:done` override the preference
 * would make the preference mean two things depending on what else was typed.
 */

import type { Derived, Match, Refusal } from "@olai/format"
import { matching, needlesOf, parseFilter } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import type { Drawn } from "../page.ts"
import { type Counts, NOTHING_COUNTED } from "./count.ts"
import { matchesIn, narrowed, placesIn, showsTrashed } from "./drawn.ts"

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
  /**
   * What this query found, in the three numbers the bar says it in — matched
   * and drawn, held by the page, held back as done (`./count.ts` owns the
   * shape, and the sentence made of it).
   *
   * ONE VALUE rather than three accessors, because they are one fact and are
   * never read apart: the sentence needs all three or none, and three memos
   * were three chances to pair a numerator with a denominator from a different
   * frame. Every number is a PLACE — a node drawn twice is two rows, and the
   * reader is counting rows.
   */
  readonly counts: Accessor<Counts>
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
  // ({@link Counts.hiddenAsDone}) is measured against `all()`, so what
  // decides its candidate set is measured against `all()` too. Which pages draw
  // archived rows is a fact about the PAGE; what a reader hides is not.
  //
  // A MEMO OF ITS OWN, so the scan below does not track the page. What the page
  // draws is a fresh value on every revision the store publishes and on every
  // navigation — and the whole of what this reading takes from it is a boolean
  // that is constant for four of the five shapes — only a tree is scanned
  // (`./drawn.ts`'s {@link showsTrashed}). Read inline, every one of those
  // frames re-ran the matcher over the entire set to arrive at the same answer.
  const archived = createMemo(() => showsTrashed(source.all()))

  const matched = createMemo(() => {
    const indexes = source.derived()
    if (indexes === undefined || !active()) return NOTHING_MATCHED
    return new Map(
      matching(indexes, query(), { trashed: archived() }).map((
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

  /**
   * The denominator — how many places the page HOLDS, which is `all()` and
   * never what was left of it: a denominator counted over the smaller set is
   * the mixed arithmetic this reading was revisited to stop
   * ({@link Counts.held}).
   *
   * A MEMO OF ITS OWN rather than a line inside the record below, and the
   * reason is what it must NOT depend on. This walks every row of the unpruned
   * page, and its answer is a fact about the PAGE — it cannot change because
   * somebody typed a letter. Computed inside the record it would have taken
   * that record's dependencies, which include the query, and re-walked the
   * whole page per keystroke to arrive at the number it had already arrived
   * at. Solid updates a graph in one pass, so the record still reads one
   * frame's value of this.
   *
   * Guarded like the record, and for its reason: the line this feeds is only
   * ever drawn beside an active filter, and a memo is a computation whether or
   * not anybody reads it.
   */
  const held = createMemo(() => (active() ? placesIn(source.all()) : 0))

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
    /**
     * THE THREE NUMBERS AS ONE VALUE, because they are one fact — what this
     * query found on this page — and nothing ever asks for one of them alone.
     * Three accessors handed out separately were three places to put the same
     * `active()` guard, and a caller free to read a denominator now and a
     * numerator later; `./count.ts` takes the record, so a sentence about a
     * page is a sentence about ONE reading of it.
     *
     * WHAT IS HELD BACK is the difference between what the query selects on
     * this page and what survived the preference — measured over the page's own
     * rows rather than over the set, because "2 matches are hidden" is a claim
     * about what is not on this screen.
     *
     * The identity check is exact rather than an optimisation that hopes: the
     * preference hands back THE SAME VALUE when this reader is not hiding
     * anything at all, and for every page it does not reach
     * (`../settings/done.ts` is exact about which case that is), so two
     * identical readings cannot differ by a match. A reader who IS hiding
     * finished work gets a fresh value whether or not anything was hidden, and
     * then this does the subtraction it exists to do.
     *
     * BY VALUE rather than by identity, because everything upstream of it is a
     * fresh value on every revision the store publishes: without this the
     * sentence would be rebuilt on every one of them to say what it already
     * said. The three numbers ARE the value — there is nothing else in the
     * record to compare.
     */
    counts: createMemo(() => {
      if (!active()) return NOTHING_COUNTED
      const shown = matchesIn(drawn(), matched())
      return {
        shown,
        held: held(),
        hiddenAsDone: source.all() === source.visible()
          ? 0
          : matchesIn(source.all(), matched()) - shown,
      }
    }, NOTHING_COUNTED, {
      equals: (was, is) =>
        was.shown === is.shown && was.held === is.held &&
        was.hiddenAsDone === is.hiddenAsDone,
    }),
  }
}
