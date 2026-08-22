/**
 * HOW MUCH OF THIS QUERY THE PAGE IS NOT SHOWING — the number under the one
 * search box, and the door that widens.
 *
 * ## What it answers, exactly
 *
 * *Every node and document the query selects that this page does not draw.* Not
 * "in other files", not "in the directory": the COMPLEMENT of what is on
 * screen, over the same corpus, under the same archive rule the page is read
 * with. That sentence is the whole of the fix — the first shipping version
 * subtracted two numbers taken from two different questions, and both reviewers
 * of #334 constructed pages where the answer was wrong rather than merely
 * misworded.
 *
 * ## Why a number computed in the browser could not be right
 *
 * The browser held the page's own matched ids (its narrowing) and asked
 * `search_nodes` with no scope for a directory total, then subtracted. That is
 * `|directory| − |page|`, which is the complement ONLY where the page's matches
 * are a subset of the directory's — and three pages break it:
 *
 *   - **The trash.** A page filter over `/trash` matches ARCHIVED nodes; a
 *     directory-wide search leaves them out unless the query says `is:trashed`
 *     (docs/search.md). The two sets are disjoint, so the subtraction takes
 *     live matches away for archived ones and the clamp at zero then hides the
 *     line: ten archived matches on the page and three live ones elsewhere read
 *     as `max(0, 3 − 10) = 0`, and the bar said nothing at all.
 *   - **A zoom.** `/#id` draws one subtree; matches in the SAME FILE outside it
 *     are not on the page and are not in another file either.
 *   - **A day, and the agenda.** Their rows come from several files already, and
 *     an undated match in one of those files is "not on this page" while being
 *     in a file the page is drawing.
 *
 * None of those is a wording problem the browser can fix, because the browser
 * cannot see the intersection. So the question is asked where both sets are:
 * here, over one snapshot, in one pass.
 *
 * ## And why it is still a CALL
 *
 * Unchanged, and it is the trade the design makes deliberately
 * (docs/brainstorming/one-search-box.md): a page's narrowing is a subscription
 * because it is bounded by the PAGE, and this is bounded by the CORPUS. On the
 * revision pulse it would put a whole-vault match behind every write while any
 * page is filtered — the nine-walks-per-bulk-gesture defect
 * `filter-rides-the-page` removed, re-created one door over. So it is asked
 * once per settled keystroke and does not move again until the words do.
 *
 * DOCUMENTS COUNT, and that is not an accident of the arithmetic any more but a
 * statement: a `.md` whose prose holds the word is precisely a thing the page in
 * front of you cannot show you, because a filter selects nodes and the one page
 * made of prose is the one page with no box.
 */

import { Schema } from "effect"

import type { Derived } from "./derive.ts"
import type { Document } from "./document.ts"
import { matching, matchingDocuments, parseFilter } from "./filter.ts"
import { PageRequest, shownIn, shownOf } from "./page.ts"
import { showsPutAway } from "./narrowing.ts"
import type { BrokenFile } from "./set.ts"
import { bodiedIn } from "./set.ts"

/**
 * A PAGE AND A QUERY — {@link NarrowingRequest}'s two halves, and for its
 * reason: the page is spelled as the reading's own request, so what this counts
 * the complement OF is whatever the `page` stream is drawing.
 */
export const ElsewhereRequest = Schema.Struct({
  page: PageRequest,
  text: Schema.String,
})
export type ElsewhereRequest = typeof ElsewhereRequest.Type

/**
 * How many the query selects that this page does not draw — and the words it
 * is about.
 *
 * THE WORDS COME BACK for {@link NarrowingAnswer.text}'s reason: a number is a
 * claim about a query, and the bar must be able to tell "this is about what you
 * typed" from "this is about a query you have moved on from" by reading the
 * value that holds it.
 */
export const ElsewhereAnswer = Schema.Struct({
  text: Schema.String,
  more: Schema.Int,
})
export type ElsewhereAnswer = typeof ElsewhereAnswer.Type

/**
 * THE COMPLEMENT — every match the corpus holds that these rows do not.
 *
 * Three steps and no arithmetic across two questions: read the page, ask the
 * corpus the SAME question under the page's own archive rule, and count what
 * the page does not draw.
 *
 * `shownIn` and not the page's own narrowing answer, which is a subtler point
 * than it looks: what must not be counted is every node the page puts a title
 * on screen for, matched or not — because a node on screen is a node the reader
 * can already see, whether or not this particular query lit it. In practice the
 * two coincide (a node that did not match is not in the corpus side either),
 * and asking the page keeps this a statement about what is VISIBLE rather than
 * about what a second reading concluded.
 *
 * It is `shownIn` rather than `narrowableIn` for one page: a ZOOM's own node is
 * its heading, not a row, so the narrowable walk leaves it out — and a reader
 * standing on a matching node would have been told there was one more of it
 * elsewhere.
 */
export const elsewhereOf = (
  derived: Derived,
  documents: ReadonlyArray<Document>,
  broken: ReadonlyArray<BrokenFile>,
  request: ElsewhereRequest,
  /** What the grammar's relative words count from — the SERVER's day, the same
   *  clock the page's narrowing and `search_nodes` are answered on. */
  now: string,
): ElsewhereAnswer => {
  const filter = parseFilter(request.text, now)
  // An empty box and a query the grammar refused are both answered by the
  // parse, and the door that asks has already drawn whatever there was to say.
  if (filter.kind !== "asking") return { text: request.text, more: 0 }

  const shows = shownOf(derived, documents, broken, request.page, now)
  // THE PAGE'S OWN ARCHIVE RULE, not the directory's. This is the line the
  // trash case is about: the corpus is asked with what was put away IN SCOPE
  // exactly when the page draws it, so the two sides are one set and the
  // subtraction below is a subset relation rather than a coincidence.
  const putAway = showsPutAway(shows) || filter.speaksOfTrash

  const drawn = new Set<string>()
  for (const at of shownIn(shows)) drawn.add(at.node.id)

  let more = 0
  for (const one of matching(derived, filter, { trashed: putAway })) {
    if (!drawn.has(one.at.node.id)) more += 1
  }
  // …and the other half of the directory, which a page filter never draws: a
  // matched `.md` is always elsewhere, wherever the reader is standing.
  return {
    text: request.text,
    more: more + matchingDocuments(bodiedIn(documents), filter).length,
  }
}

/**
 * Whether two asks are the SAME QUESTION — what keeps a settled keystroke from
 * re-asking for an answer already on screen.
 *
 * Its caller is the browser (`@olai/web`'s `filter/elsewhere.ts`), and what it
 * is for is {@link sameNarrowingRequest}'s case one door over: a pane mints a
 * fresh `PageRequest` object on every revision the store publishes, so a
 * question compared by reference would be a fresh round trip per write anywhere
 * in the vault — for a number that has not moved.
 *
 * Derived from the schema, for that function's reason: a hand-written
 * comparison would be the declaration above spelled a second time, and the next
 * field added would simply not be compared.
 */
export const sameElsewhereRequest: (a: ElsewhereRequest, b: ElsewhereRequest) => boolean =
  Schema.toEquivalence(ElsewhereRequest)
