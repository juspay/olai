/**
 * WHY THIS ROW IS DRAWN — everything a row asks of the page's narrowing, in
 * one place.
 *
 * A row on a filtered page is on screen for one of three reasons: the query
 * SELECTED it, the query selected something UNDER it, or there is no query.
 * Until 2026-08-18 the page drew the first two identically and said the
 * difference only as a `data-` fact nothing was painted from — every number was
 * correct and the page was still confusing, because no row ever said why it was
 * in front of the reader (the human, from one `#deferral` tag-click). What is
 * here is that distinction spent: the words to light, the dim, and the note to
 * excerpt.
 *
 * BESIDE THE CONTEXT RATHER THAN IN IT (`./narrowed.tsx`), and it is not
 * tidiness: that file holds a provider, so it is JSX, and these are pure
 * questions over a value — three surfaces call them and a test asks them
 * directly. What it takes is the {@link Narrowed} view, never the context, so
 * nothing here has to be called during a component's setup.
 */

import type { Custom } from "@olai/format"

import { ROW_DIM } from "../blocked.ts"
import type { NodeProp } from "../search/props.ts"
import { rowProps } from "../search/props.ts"
import { NO_NEEDLES } from "./lit.ts"
import type { Narrowed } from "./narrowed.tsx"

/**
 * What a ROW publishes as `data-match`: whether the filter SELECTED it, or kept
 * it as the context that leads to one — and NOTHING at all on an unfiltered
 * page, which is the difference between "not a match" and "there is no query".
 *
 * One spelling, because three surfaces draw the attribute now — the outline
 * tree, a day's rows and the trash's piles — and it is the one fact a scenario
 * reads to tell a hit from the ancestry around it. Three copies could drift on
 * the absent-when-inactive half, which is exactly the half nothing would fail
 * over.
 *
 * Asked of an ID rather than of a row, because the three surfaces disagree
 * about what a row IS: a tree row and a trash row match by the node they SHOW
 * (`shownRecord`, the rule a fold follows too), where a day entry is a situated
 * record with no placement about it.
 */
export const matchedAttr = (
  narrowed: Narrowed,
  id: string,
): string | undefined => {
  // NOTHING TO NARROW BY is NOTHING SAID — no query, or one whose answer has
  // not arrived. One question, asked once (`./narrowing.ts`'s `selected`), so
  // this file cannot forget half of it in one of its four answers.
  const found = narrowed.selected()
  return found === null ? undefined : String(found.has(id))
}

/**
 * May this page say what it HOLDS?
 *
 * "Nothing is on this day", "Nothing is due.", "The Trash is empty.", "write
 * its first line" — each of those is a claim about the PAGE, and a query that
 * selected none of it is a claim about the QUERY, which the filter bar makes in
 * its own words ("no matches"). So every one of them is drawn on this, and it
 * is one reading rather than four `!active()`s: a page that forgot would not go
 * quiet, it would tell somebody their day was empty over a query that simply
 * found nothing.
 */
export const unfiltered = (narrowed: Narrowed): boolean => !narrowed.active()

/**
 * The words to light up in this row's title — empty for a row the query did
 * not select, and for every row of an unfiltered page.
 *
 * ALL of the query's positive words, never only the ones the matcher scored
 * this node on: a word that is not in this title simply lands nowhere
 * (`@olai/format`'s `litBy`), and asking which is which would be a second
 * matcher written in the view — the drift the shared one exists to refuse.
 */
export const lighting = (
  narrowed: Narrowed,
  id: string,
): ReadonlyArray<string> =>
  narrowed.selected()?.has(id) === true ? narrowed.needles() : NO_NEEDLES

/**
 * Is this row drawn only as the ancestry that LEADS to a match?
 *
 * The fact `data-match="false"` already published, asked as the question the
 * ink is drawn from. False on an unfiltered page, where there is no such thing
 * as context — every row is there because the page draws it.
 */
export const asContext = (narrowed: Narrowed, id: string): boolean =>
  narrowed.selected()?.has(id) === false

/**
 * How a row says it is context and not an answer — the ink for {@link
 * asContext}.
 *
 * THE SAME DIM A WAITING ROW WEARS, and the same VALUE rather than a second
 * number that agrees by hand — `../blocked.ts`'s `ROW_DIM`, which argues why
 * one row wearing both facts must not wear two opacities. Applied to a row's
 * LINE and its body for that file's other reason: opacity compounds through a
 * subtree, and an `<li>` would take every match nested under this row down
 * with it.
 *
 * Not a stylesheet rule off `data-match="false"` for the same reason: rows
 * NEST, so a descendant selector would dim the very match the context leads
 * to. The `data-narrowable` guard the tag rules need is nothing this has to
 * repeat — a row is only ever context while a query is on, and only a page
 * that can carry one has a query.
 */
export const CONTEXT_DIM = (narrowed: Narrowed, id: string): string =>
  asContext(narrowed, id) ? ROW_DIM : ""

/**
 * Did the query find this row ONLY behind its ¶ — and if so, what to look for
 * in the note?
 *
 * `desc` is the lowest-weighted field the matcher scores, so a `matched` of
 * `desc` means no word landed in the title, the id or a tag anywhere in the
 * query: the row is drawing a title with nothing the reader typed in it. That
 * is the row the excerpt exists for (`../note/excerpt.ts`), and it is the model's own
 * answer rather than a second reading of where the words are.
 *
 * Empty for every other row, which includes a node found by BOTH its title and
 * its note: the title already says why, and a second line repeating it is
 * noise on a page whose whole problem was too little signal.
 */
export const behindTheMark = (
  narrowed: Narrowed,
  id: string,
): ReadonlyArray<string> =>
  narrowed.selected()?.get(id)?.matched === "desc" ? narrowed.needles() : NO_NEEDLES

/**
 * The properties this row should DRAW, matched ones first — or nothing at all
 * for a row the query did not select on a property.
 *
 * ONE MORE ANSWER TO "why is this row here", and it arrived when the last
 * shortlist door was deleted. A hit row in the ⌘K palette drew a node's
 * `custom` map with the key a `prop:` clause matched leading it, because a row
 * that answered `prop:agent=claude-opus` with a bare title made the reader open
 * each hit to find the fact they had just searched by (`../search/props.ts`
 * argues it). Those doors are gone; the row that answers a property query now
 * is a row of `/search?q=…`, and this is where it asks.
 *
 * WHICH KEYS MATCHED IS THE SERVER'S (`MatchedNode.matchedProps`), never
 * re-derived here from the query text — the same rule that file keeps, and for
 * its reason: folding and negation would both have to be re-decided, and a node
 * selected by `-prop:agent` was not selected ON `agent`.
 *
 * NOTHING FOR A CONTEXT ROW and nothing for an unmatched one: an ancestor is
 * kept because something under it matched, so its own properties are not the
 * answer to anything the reader asked.
 */
export const propsOf = (
  narrowed: Narrowed,
  id: string,
  custom: Custom,
): ReadonlyArray<NodeProp> => {
  const why = narrowed.selected()?.get(id)
  return why?.matchedProps === undefined ? NO_PROPS : rowProps(custom, why.matchedProps)
}

/** A row with nothing to say about itself — ONE value, for `NO_NEEDLES`'
 *  reason: every row of every filtered page asks this on every frame. */
const NO_PROPS: ReadonlyArray<NodeProp> = []
