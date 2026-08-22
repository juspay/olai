/**
 * THE WHOLE DIRECTORY, AS A PAGE — what `/search?q=…` shows.
 *
 * ## Why there is a page at all
 *
 * Because the two doors that could see past one file were SHORTLISTS: eight
 * rows, no address, not pinnable, gone the moment the box lost the caret. A tag
 * written on five nodes in three outlines was therefore a thing this app could
 * match and could not SHOW — which is the complaint the human filed on
 * 2026-08-21 and the whole of what this reading answers
 * (docs/brainstorming/one-search-box.md).
 *
 * ## What it is, in one sentence
 *
 * The page's own filter, asked of every outline at once — `matching` over the
 * set, then each file's tree pruned by {@link keeping}, which is exactly what a
 * filtered page in front of somebody already does. One matcher, one prune, one
 * meaning for `is:done`, and nothing here that a page does not already do to
 * itself.
 *
 * So the two rules the filter is made of hold here word for word: **a match
 * keeps its whole subtree**, and **a row that did not match is kept only as the
 * ancestry that leads to one**. The reason is the same one: a bare `order` means
 * nothing until you can see what it is under.
 *
 * ## Why the ANSWER carries which rows matched
 *
 * {@link Everywhere.matched} is the same `MatchedNode` list a page's narrowing
 * answers with, and it rides here rather than being asked for beside this page.
 * On every other page those are two readings on two clocks — the page moves
 * with the directory, the narrowing with the directory AND a pair of hands
 * (`./narrowing.ts`) — and asking twice is what keeps a keystroke from
 * re-sending every row.
 *
 * HERE THEY ARE ONE READING, because the page IS the query: a narrowing of
 * `/search` would be this function run a second time — the same whole-corpus
 * `matching`, the same `rowsOf`, per published revision — to re-derive a `match`
 * this pass already had in its hand. So the browser opens no narrowing stream
 * for this page at all, and lights its rows out of the answer that drew them
 * (`@olai/web`'s `filter/why.ts`, over the same `Matches` map every other page
 * builds).
 *
 * ## What is NOT here
 *
 * RANKING, and its absence is the point: a shortlist ranks
 * because it has to choose eight, and this chooses nothing. Files come in path
 * order and rows in the file's own order, which is where a reader will look for
 * them again tomorrow.
 *
 * ## The two caps, and the one sentence that says both
 *
 * {@link EVERYWHERE_LIMIT} MATCHES, and {@link EVERYWHERE_ROWS} ROWS — because
 * a match keeps its whole subtree, so two hundred matches is not two hundred
 * rows and a cap on one is no bound at all on the other. Both are applied file
 * by file in the set's own path order, so what is dropped is the tail of the
 * directory rather than a sample of every file — and a file whose FIRST group
 * is already over the row budget is taken anyway, because one big answer beats
 * none.
 *
 * NEITHER IS SILENT. {@link Everywhere.matches} is the uncapped number and
 * {@link Everywhere.drawn} is what the groups actually hold, so whichever bound
 * bit, the bar says `200 of 1340 matches` rather than drawing two hundred rows
 * as though that were the answer. A silent cap is the failure this whole arc is
 * about; a loud one is a number and another word in the query.
 *
 * DOCUMENTS ARE UNCAPPED, and that is a fact about the list rather than
 * generosity: it is bounded by the number of served files, which the sidebar
 * already draws in full, and a document hit is one line.
 *
 * ## And the files it never opens
 *
 * A file that holds no match is never walked. `matching` says which file every
 * match is in, so `rowsOf` runs over those files and no others — where a naive
 * pass would materialise a `Row` per node of the whole directory, per revision,
 * to throw nearly all of it away in `keeping`.
 *
 * WHICH MEANS A MIRROR OF A MATCH IS NOT A ROW HERE, and that is right rather
 * than a cost of the bound: the node itself is already on this page, in the file
 * it lives in, so a placement of it elsewhere would be the same node twice —
 * which is the very reason `matching` answers with no mirrors either.
 */

import { Schema } from "effect"

import { type Derived, Row, rowsOf } from "./derive.ts"
import type { Document } from "./document.ts"
import type { Filter, Matched } from "./filter.ts"
import { keeping, matching, matchingDocuments, parseFilter, rowsIn } from "./filter.ts"
import { DocumentHit, documentHitOf, MatchedNode } from "./searching.ts"
import { bodiedIn } from "./set.ts"

/**
 * How many matched NODES `/search` draws before it starts saying so.
 *
 * A number, not a principle. It is here because a query matching ninety
 * thousand nodes would otherwise put ninety thousand rows on one frame, and
 * "page it" is a second navigation vocabulary for an answer whose real fix is
 * another word in the query. What makes it honest rather than a cap is
 * {@link Everywhere.matches}, which is never cut.
 */
export const EVERYWHERE_LIMIT = 200

/**
 * …and how many ROWS those matches may bring with them.
 *
 * The second bound exists because the first is not one: a match keeps its whole
 * subtree ({@link keeping}), so a single hit on a file's root puts that file's
 * every node on the wire. Counted after the prune, file by file, and reported
 * through {@link Everywhere.drawn} like the other — a group that would take the
 * page past it is not added, and the bar says the difference.
 */
export const EVERYWHERE_ROWS = 2000

/** One outline that holds a match, and its tree pruned to the matches with the
 *  ancestry that leads to them — {@link TrashGroup}'s shape and {@link
 *  DayGroup}'s idea: a file heading, and what is under it. */
export const EverywhereGroup = Schema.Struct({
  file: Schema.String,
  rows: Schema.Array(Row),
})
export type EverywhereGroup = typeof EverywhereGroup.Type

/**
 * WHAT `/search?q=…` SHOWS — an arm of {@link Shown} like any other page's.
 *
 * `text` rides on the answer for {@link NarrowingAnswer.text}'s reason: it is
 * how the bar knows whether the rows in front of somebody answer what is typed
 * or a query they have already moved on from, read off the value that holds
 * them rather than off a signal beside it that is free to be a frame ahead.
 */
export const Everywhere = Schema.Struct({
  kind: Schema.Literal("search"),
  text: Schema.String,
  groups: Schema.Array(EverywhereGroup),
  documents: Schema.Array(DocumentHit),
  /**
   * Every node these groups DRAW that the query selected, and why — the same
   * shape a page's narrowing answers with, so a row lights and dims out of one
   * reading (the header argues why it rides here).
   */
  matched: Schema.Array(MatchedNode),
  /** How many NODES the query selected in the whole directory — NEVER cut,
   *  which is what makes the caps sayable. */
  matches: Schema.Int,
  /** How many of those the groups below actually draw — `matched.length`, equal
   *  to `matches` until one of the two bounds bites and smaller after. */
  drawn: Schema.Int,
})
export type Everywhere = typeof Everywhere.Type

/** What `/search` shows before anybody has typed anything, and for a query the
 *  grammar refused — ONE value, shared, for `NOTHING_MATCHED`'s reason: an
 *  empty page is produced on every revision the store publishes, and a fresh
 *  record per frame is a fresh value for whatever compares against it. */
const NOTHING_FOUND = {
  groups: [],
  documents: [],
  matched: [],
  matches: 0,
  drawn: 0,
} as const

/**
 * THE READING — every outline's tree, pruned to what the query selects.
 *
 * A QUERY THE GRAMMAR COULD NOT READ finds nothing, and so does an empty box:
 * both are answered by the parse, and the door that asks has already drawn
 * whatever there was to say about them (`./narrowing.ts` makes the same call
 * one page over). An empty `/search` is a page that says "type to search",
 * which is a page rather than a hole.
 *
 * THE ARCHIVE RULE IS THE MATCHER'S, unchanged: `matching` leaves what was put
 * away out unless the query says `is:trashed`, so a trash file's tree prunes to
 * nothing and its group drops out — the same sentence the one-page rule makes
 * everywhere else, kept by the same function rather than restated here.
 */
export const everywhereOf = (
  derived: Derived,
  documents: ReadonlyArray<Document>,
  text: string,
  /** What the grammar's relative words count from — the SERVER's day, the same
   *  clock `search_nodes` and the page's narrowing are answered on. */
  now: string,
): Everywhere => {
  const filter = parseFilter(text, now)
  if (filter.kind !== "asking") return { kind: "search", text, ...NOTHING_FOUND }

  const found = matching(derived, filter)
  const documented = foundDocuments(documents, filter)
  // NO MATCH IS NO WALK. Without this the loop below still opens every outline
  // in the directory to prune each of them to nothing — which is the commonest
  // query of all, the one somebody is half-way through typing.
  if (found.length === 0) {
    return { kind: "search", text, ...NOTHING_FOUND, documents: documented }
  }

  // WHICH FILES HOLD A MATCH, in the set's own path order — the only files
  // `rowsOf` is run over. See the header: a mirror of a match in some other
  // file is deliberately not a row here, because the node itself already is.
  const byFile = new Map<string, Array<MatchedNode>>()
  for (const one of found) {
    const held = byFile.get(one.at.file)
    if (held === undefined) byFile.set(one.at.file, [matchedOf(one)])
    else held.push(matchedOf(one))
  }

  const groups: Array<EverywhereGroup> = []
  const matched: Array<MatchedNode> = []
  let rows = 0
  for (const [file, held] of byFile) {
    // THE TWO BOUNDS, checked before the file is opened rather than after — a
    // group that would take the page past either is not built at all. The first
    // group is exempt from the ROW bound: one big answer beats none, and the
    // bar says the difference either way ({@link Everywhere.drawn}).
    if (matched.length + held.length > EVERYWHERE_LIMIT && matched.length > 0) break
    // THE FILE'S OWN TREE, pruned exactly as a filtered page prunes itself.
    const kept = keeping(rowsOf(derived, file), new Set<string>(held.map((one) => one.id)))
    const places = rowsIn(kept)
    if (rows + places > EVERYWHERE_ROWS && groups.length > 0) break
    groups.push({ file, rows: kept })
    matched.push(...held)
    rows += places
  }

  return {
    kind: "search",
    text,
    groups,
    documents: documented,
    matched,
    matches: found.length,
    drawn: matched.length,
  }
}

/** One selected record as the id-and-why every narrowing answers with — the
 *  format's own rule for absence, applied twice: a query that named no words
 *  was carried by no field, and one that named no property matched none. */
const matchedOf = (one: Matched): MatchedNode => ({
  // CAST rather than `NodeId.make`, and it is the same call `./address.ts`
  // argues for at its own hot spot: the brand is nominal, so `make` runs a
  // parser with nothing to check, and this list is the size of the answer.
  id: one.at.node.id as MatchedNode["id"],
  ...(one.match.field === null ? {} : { matched: one.match.field }),
  ...(one.match.props.length === 0 ? {} : { matchedProps: one.match.props }),
})

/** The other half of the directory, asked the same question — `.md` and `.html`
 *  alike, in the set's own path order. No ranking, for the reason the rows have
 *  none: nothing here is choosing which few to show. */
const foundDocuments = (
  documents: ReadonlyArray<Document>,
  filter: Filter,
): ReadonlyArray<DocumentHit> =>
  matchingDocuments(bodiedIn(documents), filter).map(documentHitOf)
