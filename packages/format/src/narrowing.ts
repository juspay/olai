/**
 * WHICH OF THIS PAGE'S NODES THE QUERY SELECTS — the reading beside the page's
 * own, and the whole of what a filter box is answered with.
 *
 * ## Why this file exists
 *
 * The narrowing used to be a SEARCH OF THE DIRECTORY that a page then pruned:
 * `search.matching`, one whole-vault walk per settled keystroke AND per
 * published revision, answered with every id in the corpus that matched, of
 * which a page looked up only the ones it happened to draw. On a 90,000-node
 * vault one bulk gesture on a filtered page cost nine of those walks, one per
 * frame, and no window in a browser collapses them — the frames of a bulk
 * gesture arrive a procedure round trip apart (measured in olai#290, built both
 * ways, deleted).
 *
 * The observation this file is made of: **every reader of that answer was a
 * membership test against a row the page already draws.** Nothing else was
 * ever asked of it. And a page's reading has already resolved every mirror, so
 * the records it draws are a set the server holds in its hand — which makes
 * the honest question O(page) rather than O(corpus), and makes it a STANDING
 * reading on the revision pulse rather than a call per frame. The design, and
 * the shape that lost, is docs/brainstorming/filter-rides-the-page.md.
 *
 * ## What is NOT decided here
 *
 * WHAT A QUERY MEANS is `./filter.ts`'s, exactly as it is for `search_nodes`
 * and the ⌘K palette: the same `parseFilter` reads the words and the same
 * matcher selects the nodes ({@link selecting}, which is the walk `matching`
 * runs with the set's own records in place of a page's). One grammar, one
 * matcher, one answer to `is:done` — the rule docs/search.md exists to hold,
 * kept structurally rather than by two implementations that agree.
 *
 * WHAT A READER HAS HIDDEN is not here either, and that is the division of
 * labour this reading is careful about: done-hiding is a preference of a
 * BROWSER and it goes FIRST, so the server answers the SELECTION and the page
 * prunes (`@olai/web`'s `filter/narrowing.ts` argues the order; a server that
 * pruned would need the preference on the wire, and could not produce the
 * held-back count at all). **The server says which nodes; the page says which
 * rows.**
 *
 * WHICH PAGE this is about is {@link PageRequest}'s, unchanged — the same value
 * the `page` stream takes, so a narrowing is always a narrowing of a page
 * somebody could be looking at.
 *
 * AND WHICH RECORDS OF IT are `./page.ts`'s, for the same reason one layer in:
 * what counts as a ROW of a page is a fact about the page, so this reading is
 * handed them rather than walking the arms a second time.
 */

import { Schema } from "effect"

import type { Derived, Row } from "./derive.ts"
import type { Document } from "./document.ts"
import { type Filter, parseFilter, selecting, shownRecord } from "./filter.ts"
import { isTrashed, type LocatedRegular } from "./node.ts"
import { narrowableIn, PageRequest, type Shown, shownOf } from "./page.ts"
import { MatchedNode } from "./searching.ts"
import type { BrokenFile } from "./set.ts"

/**
 * A PAGE AND A QUERY — the two halves of "what does this box select".
 *
 * The page is spelled as the reading's own request rather than as an address,
 * so the two members answer about the same page by construction: whatever the
 * `page` stream is drawing is what this one narrows.
 *
 * THE WORDS and not the parse, for {@link MatchedNode}'s reason one door over:
 * what a query MEANS is one paragraph and one function, and the relative words
 * in it count from the SERVER's clock, exactly as the palette's and an agent's
 * `search_nodes` do.
 */
export const NarrowingRequest = Schema.Struct({
  page: PageRequest,
  text: Schema.String,
})
export type NarrowingRequest = typeof NarrowingRequest.Type

/**
 * Every node THIS PAGE draws that the query selects — ids and why, in the order
 * the page draws them.
 *
 * NO CAP and no ranking, for the reason the door it replaced had none: the
 * caller prunes itself by the ids and counts itself against them, so "3 of 41"
 * is not sayable off an answer that stopped at twelve, and a tree is drawn in
 * the tree's order. What is new is that the list is bounded by the PAGE rather
 * than by the corpus — the same sentence, with the size fixed.
 *
 * NO REFUSALS, unchanged: a refusal is what the GRAMMAR made of the words, and
 * the door that asks this reads the same grammar itself, so it has drawn the
 * sentence before a round trip could carry one.
 *
 * THE WORDS COME BACK, and that field is load-bearing rather than an echo: it
 * is how the bar knows whether the rows in front of somebody answer what is
 * typed or a query they have moved on from, read off the value that holds them
 * rather than off a signal beside it that is free to be a frame ahead.
 */
export const NarrowingAnswer = Schema.Struct({
  text: Schema.String,
  matches: Schema.Array(MatchedNode),
})
export type NarrowingAnswer = typeof NarrowingAnswer.Type

/**
 * Whether two narrowings say the same thing — what keeps a revision that moved
 * no match from sending a frame to the page it is narrowing.
 *
 * This is the whole fix in one line: a bulk gesture that ticks thirty rows off
 * a page filtered by a word in their titles changes which nodes are DONE and
 * not which nodes MATCH, so thirty revisions produce thirty re-reads on this
 * side and nothing at all on the wire.
 *
 * DERIVED from the schema, for `./page.ts`'s reason word for word: a
 * hand-written comparison would be the declaration above spelled a second time,
 * and the next field added would simply not be compared.
 */
export const sameNarrowing: (a: NarrowingAnswer, b: NarrowingAnswer) => boolean =
  Schema.toEquivalence(NarrowingAnswer)

/**
 * Whether two narrowings are the SAME QUESTION — what keeps a subscription open
 * across a frame that changed neither the page nor the words.
 *
 * Its caller is the browser (`@olai/web`'s `filter/asking.ts`), and what it is
 * for is the same case {@link samePageRequest} answers one door over: a
 * subscription re-opens whenever its input NOTIFIES, and a pane mints a fresh
 * request object on every revision the store publishes. Without this, every
 * write anywhere in the vault would tear this stream down and ask again for the
 * answer it is already holding — which is the defect this whole member exists
 * to end.
 *
 * Derived from the schema for {@link sameNarrowing}'s reason.
 */
export const sameNarrowingRequest: (a: NarrowingRequest, b: NarrowingRequest) => boolean =
  Schema.toEquivalence(NarrowingRequest)

/**
 * THE READING — what the query selects on the page the request names.
 *
 * Two walks and neither is of the corpus: the page, and the ROWS the page draws
 * (`./page.ts`'s `narrowableIn`, which is where that walk belongs — see
 * {@link prunable}). `shownOf` rather than `pageOf`, because the names table
 * beside a page resolves the ids that page POINTS AT and nothing here reads one.
 */
export const narrowingOf = (
  derived: Derived,
  faces: ReadonlyArray<Document>,
  broken: ReadonlyArray<BrokenFile>,
  request: NarrowingRequest,
  /** What the grammar's relative words count from — the same clock
   *  `search_nodes` is answered on. */
  now: string,
): NarrowingAnswer => ({
  text: request.text,
  matches: narrowedIn(
    derived,
    shownOf(derived, faces, broken, request.page, now),
    parseFilter(request.text, now),
  ),
})

/**
 * The same reading over a page ALREADY COMPUTED — the half that is about the
 * query, for a caller holding a {@link Shown}.
 *
 * A query the grammar could not read selects nothing, and neither does an empty
 * box: both are answered by the parse, and the door that asks has already drawn
 * whatever there was to say about them.
 */
export const narrowedIn = (
  derived: Derived,
  shows: Shown,
  filter: Filter,
): ReadonlyArray<MatchedNode> => {
  if (filter.kind !== "asking") return []
  const putAway = showsPutAway(shows) || filter.speaksOfTrash
  // ONE ARRAY, which is what {@link selecting} being a generator is for: a
  // selection materialised and then mapped is two lists of the answer's size
  // where the second is what anybody reads.
  const out: Array<MatchedNode> = []
  for (const { at, match } of selecting(derived, filter, prunable(shows), putAway)) {
    out.push({
      // CAST rather than `NodeId.make`, and it is the same call `./address.ts`
      // argues for at its own hot spot: the brand is nominal, so `make` runs a
      // parser with nothing to check, and this list is uncapped.
      id: at.node.id as MatchedNode["id"],
      // The format's own rule for absence: a query that named no words was
      // carried by no field, and naming one would be inventing the reason a row
      // is in front of somebody.
      ...(match.field === null ? {} : { matched: match.field }),
    })
  }
  return out
}

/**
 * Is the page in front of the reader drawing anything that was PUT AWAY?
 *
 * Archived nodes are out of every reading unless a query says `is:trashed`
 * (docs/search.md), because the doors that rule is written for are searching
 * the DIRECTORY. This one is not: it tests the rows in front of somebody, and
 * the TRASH is the page that draws what was put away — applying the default
 * there would take every row away and leave the reader nothing to read the
 * absence by.
 *
 * TWO PAGES CAN BE, and after the 2026-08-17 ruling that is the whole list. The
 * TRASH is the archive, every group of it — so the answer is its kind and not a
 * scan, because a trash drawing no archived row is a trash drawing no row. And
 * a ZOOM can be one node's: `/#<id>` on a node somebody put away, which is
 * exactly where an `is:trashed` hit lands when it is clicked.
 *
 * A DAY AND THE AGENDA ANSWER NO, and by construction rather than by a rule
 * kept here: the walk those pages are built from leaves archived nodes out
 * (`./dates.ts`, ruled 2026-08-17), so there is nothing on either of them for
 * this to find. Left as arms rather than folded into a default, because a page
 * kind that starts drawing archived rows should have to come back here.
 *
 * THE ROOTS, never a walk — a row shows a record that names a file, and a zoom
 * is inside one file the whole way down. That is the honest bound, and it has
 * one gap that is not this function's to close: a MIRROR still resolves to a
 * node archived after it was placed (`./derive.ts`'s `follow`), so a placement
 * can draw an archived row on a live page. What that row should BE is a ruling
 * about the set rather than about a filter, and is filed as one (docs/search.md,
 * docs/brainstorming/editing-web.md's Open).
 *
 * WHAT IT NO LONGER DECIDES is a candidate set. It used to be the browser's
 * (`@olai/web`'s `filter/drawn.ts`), and `true` put every archived node in the
 * DIRECTORY in front of the matcher for the page's prune to drop again. The
 * candidates are the page's own rows now, so all this says is whether the ones
 * that were put away are allowed to match.
 */
export const showsPutAway = (shows: Shown): boolean => {
  switch (shows.kind) {
    case "trash":
      return true
    case "outline":
      return anyPutAway(shows.rows)
    case "node":
      return shows.zoomed.kind === "node" && anyPutAway(shows.zoomed.children)
    // THE MATCHER ALREADY DECIDED, one reading over: `/search` is `matching`
    // over the whole set, which leaves what was put away out unless the query
    // said `is:trashed` — and when it did, `narrowedIn` below reads that off
    // the query itself. A `true` here would be this reading answering a
    // question the page has already answered.
    case "search":
    case "document":
    case "day":
    case "agenda":
    case "broken":
    case "nothing":
      return false
  }
}

/** The two tree arms' shared question, said once: does any ROOT of this tree
 *  show a record that was put away? `shownRecord`, because a mirror draws the
 *  file its target lives in and that is the file this is about. */
const anyPutAway = (rows: ReadonlyArray<Row>): boolean =>
  rows.some((row) => isTrashed(shownRecord(row).file))

/**
 * EVERY RECORD A FILTER CAN TAKE OFF THIS PAGE, once each.
 *
 * The WALK is `./page.ts`'s (`narrowableIn`), and that is where it belongs:
 * "what is a ROW of this page" is a fact about the page, so a second walk here
 * would be a filter and a names table free to disagree about one reading — and
 * a page kind that grew a place to draw a node would have to be told twice.
 *
 * WHAT IS LEFT HERE IS THE DEDUP, because it is this reading's own question and
 * not that walk's. A PLACEMENT is not a node: one node drawn twice is two rows
 * and one candidate, and the answer is a set of ids a page looks itself up in.
 * `matching` needs no such guard — `derived.nodes` names each record once —
 * which is why it is here rather than in the matcher or in the walk.
 */
function* prunable(shows: Shown): Generator<LocatedRegular> {
  const seen = new Set<string>()
  for (const at of narrowableIn(shows)) {
    if (seen.has(at.node.id)) continue
    seen.add(at.node.id)
    yield at
  }
}
