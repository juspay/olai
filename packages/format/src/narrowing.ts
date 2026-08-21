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
 */

import { Schema } from "effect"

import type { DayGroup } from "./dates.ts"
import type { Row } from "./derive.ts"
import type { Face } from "./document.ts"
import { type Derived } from "./derive.ts"
import { type Filter, parseFilter, selecting, shownRecord } from "./filter.ts"
import { isTrashed, type LocatedRegular } from "./node.ts"
import { PageRequest, type Shown, shownOf } from "./page.ts"
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
 * Two walks and neither is of the corpus: the page, and the records the page
 * draws. `shownOf` rather than `pageOf`, because the names table beside a page
 * resolves the ids that page POINTS AT and nothing here reads one.
 */
export const narrowingOf = (
  derived: Derived,
  faces: ReadonlyArray<Face>,
  broken: ReadonlyArray<BrokenFile>,
  request: NarrowingRequest,
  /** What the grammar's relative words count from — the same clock
   *  `search_nodes` is answered on. */
  now: string,
): NarrowingAnswer => ({
  text: request.text,
  matches: narrowedIn(
    derived,
    shownOf(derived, faces, broken, request.page),
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
  return selecting(derived, filter, prunable(shows), showsPutAway(shows) || filter.speaksOfTrash)
    .map(({ at, match }) => ({
      // CAST rather than `NodeId.make`, and it is the same call `./address.ts`
      // argues for at its own hot spot: the brand is nominal, so `make` runs a
      // parser with nothing to check, and this list is uncapped.
      id: at.node.id as MatchedNode["id"],
      // The format's own rule for absence: a query that named no words was
      // carried by no field, and naming one would be inventing the reason a row
      // is in front of somebody.
      ...(match.field === null ? {} : { matched: match.field }),
    }))
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
      return shows.rows.some((row) => isTrashed(shownRecord(row).file))
    case "node":
      return shows.zoomed.kind === "node" &&
        shows.zoomed.children.some((row) => isTrashed(shownRecord(row).file))
    case "document":
    case "day":
    case "agenda":
    case "broken":
    case "nothing":
      return false
  }
}

/**
 * EVERY RECORD A FILTER CAN TAKE OFF THIS PAGE, once each.
 *
 * The candidate set, and it is defined by what the PRUNE tests rather than by
 * what the reading carries: `keeping`, `keepingDated` and `keepingOwed` each
 * ask about the node a row SHOWS, and nothing else on a page is a row. So a
 * zoom's crumbs, its backlinks, a document's referrers and the blockers under a
 * mark are all out — a filter never took one of them away, and a match found
 * only there would be an id nothing looks up.
 *
 * `shownRecord` rather than the row's own, which is the rule the prune already
 * follows: a mirror of a matching node survives wherever it is drawn, so the
 * node it shows is the node this asks about.
 *
 * ONCE EACH, because a PLACEMENT is not a node: one node drawn twice is two
 * rows and one candidate, and the answer is a set of ids a page looks itself up
 * in. `matching` needs no such guard — `derived.nodes` names each record once —
 * which is why the dedup is here rather than in the matcher.
 *
 * IT IS THE SECOND WALK OVER `Shown` IN THIS PACKAGE, and that is deliberate
 * rather than a duplicate: `./page.ts`'s `drawnIn` yields every record a page
 * MENTIONS, because what it feeds is the names table, and a crumb, a backlink,
 * a referrer and a blocker all point at something. None of those is a row, and
 * a filter has never taken one away — so a match found only there would be an
 * id nothing looks up. Two questions, two walks; both `switch` exhaustively
 * over the same union, so a sixth page kind is a compile error in both rather
 * than a silence in one.
 */
function* prunable(shows: Shown): Generator<LocatedRegular> {
  const seen = new Set<string>()
  for (const at of drawn(shows)) {
    if (seen.has(at.node.id)) continue
    seen.add(at.node.id)
    yield at
  }
}

function* drawn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* inRows(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") yield* inRows(shows.zoomed.children)
      return
    case "day":
      yield* inGroups(shows.groups)
      return
    case "agenda":
      for (const day of shows.agenda.overdue) yield* inGroups(day.groups)
      yield* inGroups(shows.agenda.today)
      for (const day of shows.agenda.upcoming) yield* inGroups(day.groups)
      return
    case "trash":
      for (const group of shows.groups) yield* inRows(group.rows)
      return
    case "document":
    case "broken":
    case "nothing":
      return
  }
}

function* inRows(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    // A row that shows nothing — a mirror whose chain died, one that closed a
    // loop — draws its own PLACEMENT rather than a node, and there is nothing
    // in a placement for a query to select. `keeping` keeps such a row when
    // something under it matched, which is the same answer this absence gives.
    if (row.kind === "node" || row.kind === "mirror") yield row.shows
    yield* inRows(row.children)
  }
}

function* inGroups(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) for (const entry of group.nodes) yield entry.shows
}
