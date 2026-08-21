/**
 * The page's filter, as one reading.
 *
 * Everything a filtered page needs is derived from ONE string — the `?q=` on
 * the address (`../routes.ts`) — and it is derived here rather than in the
 * components, so the bar's count, the rows the page draws and the folds a tree
 * suspends cannot come to three different conclusions about the same query.
 *
 * THE MATCHING IS NOT HERE, and since `search-server-side` it is not in this
 * browser at all: which nodes a query selects is answered by the server, over
 * the same `@olai/format` matcher an agent's `search_nodes` is gated by
 * (`./asking.ts` is the round trip, and says what it cost). What IS still read
 * here is the GRAMMAR over the box's own text — whether there is a query, what
 * it refused, which words to light — because a parse reads the query string and
 * nothing about the directory, and a refusal that waited for a round trip would
 * be a reader typing on past a sentence the app could have said at once.
 *
 * So this file decides only what to do with the answer, which is what its
 * header always claimed; what changed is that the answer now ARRIVES, and two
 * of the decisions below are about that (`matched`, `drawn`).
 *
 * WHATEVER THE PAGE IS. The filter used to be the two tree pages' and is now
 * every page that draws nodes (`../page.ts`'s {@link Drawn}), which cost this
 * file one switch rather than a second reading: the ids a query selects are the
 * same set on any page, and what differs is only the shape they are tested
 * against — a tree keeps the ancestors that lead to a match, a day and the
 * agenda are flat rows that arrive carrying their own ancestry, the trash is a
 * tree per archive.
 *
 * THE TRASH IS NOT ASKED FOR ANY MORE, and its absence is worth a paragraph
 * because it was this reading's one word to the matcher about the QUESTION.
 * Archived nodes are out of every reading unless a query says `is:trashed`
 * (docs/search.md), because the doors that rule is written for are searching the
 * DIRECTORY — where this one tests the rows in front of somebody, and the TRASH
 * is the page that draws what was put away. This file used to answer that for
 * the matcher, off the page it holds; the matcher reads it off the page ITSELF
 * now (`@olai/format`'s `showsPutAway`, over the `Shown` the server computed),
 * which is the same sentence with nobody left to describe a page to anybody
 * (docs/brainstorming/filter-rides-the-page.md).
 *
 * The ORDER of the two prunings is the decision worth naming: done-hidden goes
 * FIRST. It is a standing claim about the reader ("I do not want to look at
 * finished work"); the filter is a question about the page. So the filter reads
 * what the preference left, and `is:done` under a done-hiding preference draws
 * nothing — which is said out loud ({@link Counts.hiddenAsDone}) rather than
 * special-cased away. Letting an explicit `is:done` override the preference
 * would make the preference mean two things depending on what else was typed.
 */

import type { Filter, Refusal } from "@olai/format"
import { needlesOf } from "@olai/format"
import { type Accessor, createMemo } from "solid-js"

import type { Drawn } from "../page.ts"
import type { Matches } from "./matches.ts"
import { type Counts, NOTHING_COUNTED } from "./count.ts"
import { matchesIn, narrowed, placesIn } from "./drawn.ts"

/** WHAT A QUERY THAT SELECTED NOTHING SELECTED — the answer a refused query
 *  gets here, and the fallback the counts read. ONE value, shared: a fresh
 *  `new Map()` per read would be a new value every frame, and every row of the
 *  tree memoises against this one. (A page with nothing to narrow BY is
 *  `null` rather than this — {@link Narrowing.selected} argues the difference,
 *  and it is the whole of what a round trip added to this reading.) */
export const NOTHING_MATCHED: Matches = new Map()

/** What a filtered page knows about itself. */
export interface Narrowing {
  /** What was typed, verbatim — the value in the box. */
  readonly text: Accessor<string>
  /** Is there a filter at all? An empty box is not a filter; a box holding a
   *  query the grammar refused IS one, and it selects nothing.
   *
   *  READ OFF THE PARSE and never off the answer, so it is true the instant
   *  somebody types: a page whose folds unsuspend a round trip after the query
   *  appeared would be a page that hides the match it is about to draw. */
  readonly active: Accessor<boolean>
  /** What the grammar could not read, in its own words — empty for every query
   *  it could. Lifted off the parsed value rather than handed out with it: the
   *  bar wants the sentences, and nothing in this client has any business
   *  reading a query's terms apart from the matcher that owns them. */
  readonly refusals: Accessor<ReadonlyArray<Refusal>>
  /**
   * WHAT THE QUERY SELECTED, or `null` for a page with nothing to narrow BY.
   *
   * A MAP where this was a `Set` of ids, and the whole of that change is what a
   * ROW can now ask. The prune only ever asked membership (`Selected`, the
   * question `keeping` takes) — but a row that draws why it is in front of
   * somebody has to know which FIELD carried the hit, since a match found only
   * behind the ¶ draws a title with nothing the query said in it. Keeping a
   * second structure beside the set was the alternative, and two answers to one
   * question are free to disagree by a frame.
   *
   * NULL IS THE THIRD STATE, and it is one accessor rather than a boolean
   * beside the map because the readers are the ones who would have to remember
   * the pair: no filter at all, and a filter nothing has answered YET, are both
   * "there is nothing to narrow by" — and an empty MAP is a third thing
   * entirely, a query that was answered and selected nothing. Spelled as a map
   * plus an `answered` flag, every row-level question grew the same guard and a
   * fourth one could forget it: a whole outline publishing
   * `data-match="false"` and wearing the context dim, because somebody typed a
   * letter and the answer had not landed.
   *
   * A MAP THAT IS NOT NULL IS THE LAST ANSWER THAT ARRIVED, which is the honest
   * thing for it to be while a newer one is in flight: the rows on screen were
   * narrowed by it, so a row asking why it is drawn is answered out of the same
   * map that drew it. Whether it answers what is TYPED is {@link answering}.
   */
  readonly selected: Accessor<Matches | null>
  /** The words the query looks for, folded — what a matched row lights up in
   *  its title (`@olai/format`'s `needlesOf`, and `./lit.ts` for the split).
   *  Empty for a query that named none (`is:done`) and for no query at all. */
  readonly needles: Accessor<ReadonlyArray<string>>
  /** What the page actually draws: done-hidden first, then narrowed. */
  readonly drawn: Accessor<Drawn>
  /**
   * WHICH query the page in front of the reader answers — `null` while it
   * answers one they have already moved on from.
   *
   * A filter is a debounce and a round trip now, so there are two moments when
   * what is drawn is not what is typed: the settle, and the flight. Both are
   * this one fact, and it is SAID rather than acted on, because acting on it is
   * worse than either: blanking the page per keystroke, or drawing the whole
   * page and re-narrowing it, are two kinds of flicker over rows somebody is
   * reading. The rows hold still, the bar says they are a question behind
   * (`./count.ts`'s {@link answeringLine}), and the answer replaces them once.
   *
   * A query the grammar refused, and no query at all, answer THEMSELVES: both
   * are read here, so there is nothing in flight and nothing to say.
   */
  readonly answering: Accessor<string | null>
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
 * The reading, over the app's inputs: the parsed query, what the open page
 * draws BEFORE the done preference is applied, the same after it, and what the
 * server said about the query.
 *
 * The two pages are handed in rather than computed here because the app already
 * has them (`../pane/PageView.tsx` composes the page and applies `visible`),
 * and a second `drawnBy` would be a second answer to what page is open. The
 * PARSE is handed in for the same reason it is handed in twice nowhere: the
 * pane parses the box once and both this reading and the question it sends are
 * built off that one value (`./asking.ts`).
 */
export const createNarrowing = (source: {
  /** What the grammar made of what was typed — `@olai/format`'s `parseFilter`
   *  over the box and the tab's own day, done by the caller. */
  readonly query: Accessor<Filter>
  readonly text: Accessor<string>
  /** What the page draws with nothing hidden — what the count of held-back
   *  matches is measured against. */
  readonly all: Accessor<Drawn>
  /** The same, with this reader's preference applied. */
  readonly visible: Accessor<Drawn>
  /** What the server said the query selects — `undefined` until it has said
   *  anything at all about this filter (`./asking.ts`'s {@link Asked}). */
  readonly matched: Accessor<Matches | undefined>
  /** Which query that answer answers, `null` while one is in flight. */
  readonly answering: Accessor<string | null>
}): Narrowing => {
  const active = createMemo(() => source.query().kind !== "nothing")
  /** Is there a question for the SERVER — which is not the same as there being
   *  a filter: a query the grammar refused is a filter that selects nothing,
   *  and asking it would be paying a round trip to be told what the parse
   *  already said. */
  const asking = createMemo(() => source.query().kind === "asking")

  /**
   * The three states, as one value. A query the grammar REFUSED is answered
   * here and selects nothing, which is an empty map rather than a `null`: the
   * page empties and the bar draws the reason, where `null` would leave it
   * drawn whole as though nothing had been typed.
   */
  const selected = createMemo<Matches | null>(() => {
    if (!active()) return null
    if (!asking()) return NOTHING_MATCHED
    return source.matched() ?? null
  })

  /**
   * ONE GUARD, over the one value that has all three states in it: with nothing
   * to narrow BY the page is drawn whole, and with a map — even an empty one —
   * it is narrowed.
   *
   * WHICH IS THE DIFFERENCE BETWEEN TWO EMPTIES, and the whole of what a round
   * trip added here: a query ANSWERED with nothing empties the page, and a
   * query nothing has answered YET may not — a page that blanked on the first
   * keystroke and filled back in 200ms later would be saying "no matches" about
   * a question nobody has answered. The bar says the rows are a question behind
   * instead ({@link Narrowing.answering}).
   */
  const drawn = createMemo(() => {
    const found = selected()
    return found === null ? source.visible() : narrowed(source.visible(), found)
  })

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
    selected,
    // A fact about the QUERY and so a memo of its own: it is read by every
    // matched row on the page, and re-deriving it per row per frame would be
    // the tree walking its own groups once for each of them.
    needles: createMemo(() => needlesOf(source.query())),
    refusals: createMemo(() => {
      const asked = source.query()
      return asked.kind === "refused" ? asked.refusals : []
    }),
    drawn,
    // A query nobody has to ask answers itself, at once: the parse is the whole
    // answer for an empty box and for a refused query, so neither is ever a
    // question behind. Everything else is the wire's word, compared against
    // what is typed rather than trusted to be about it.
    answering: createMemo(() => {
      const typed = source.text().trim()
      if (!asking()) return typed
      return source.answering() === typed ? typed : null
    }),
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
      const found = selected() ?? NOTHING_MATCHED
      const shown = matchesIn(drawn(), found)
      return {
        shown,
        held: held(),
        hiddenAsDone: source.all() === source.visible()
          ? 0
          : matchesIn(source.all(), found) - shown,
      }
    }, NOTHING_COUNTED, {
      equals: (was, is) =>
        was.shown === is.shown && was.held === is.held &&
        was.hiddenAsDone === is.hiddenAsDone,
    }),
  }
}
