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
 * ## What is NOT here
 *
 * WHY A ROW IS DRAWN is not computed twice. A `/search` page is narrowable like
 * every other page (`./page.ts`'s `narrowableIn` yields its rows), so the
 * narrowing beside it answers which of them the query selected and the browser
 * lights and dims out of that one answer — the same `filter/why.ts` every other
 * surface reads. Putting a second `matched` on each row here would be the same
 * fact spelled twice, free to disagree by a frame.
 *
 * RANKING is not here either, and its absence is the point: a shortlist ranks
 * because it has to choose eight, and this chooses nothing. Files come in path
 * order and rows in the file's own order, which is where a reader will look for
 * them again tomorrow.
 *
 * ## The cap, said out loud
 *
 * {@link EVERYWHERE_LIMIT} nodes, applied in the set's own file-then-line order
 * so whole files are kept rather than sampled — and {@link Everywhere.matches}
 * is the uncapped number beside it, so the bar can say `200 of 1340 matches`
 * rather than quietly drawing two hundred rows as though that were the answer.
 * A silent cap is the failure this whole arc is about; a loud one is a number
 * and another word in the query.
 *
 * DOCUMENTS ARE UNCAPPED, and that is a fact about the list rather than
 * generosity: it is bounded by the number of served files, which the sidebar
 * already draws in full, and a document hit is one line.
 */

import { Schema } from "effect"

import { AtDocument } from "./address.ts"
import type { Custom } from "./custom.ts"
import { type Derived, Row, rowsOf } from "./derive.ts"
import { type Document, Face } from "./document.ts"
import type { Bodied, Filter } from "./filter.ts"
import {
  DOCUMENT_FIELDS,
  keeping,
  matching,
  matchingDocuments,
  parseFilter,
} from "./filter.ts"
import { fileKind } from "./kinds.ts"
import { heldCustom, nothing } from "./write.ts"

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

/** One outline that holds a match, and its tree pruned to the matches with the
 *  ancestry that leads to them — {@link TrashGroup}'s shape and {@link
 *  DayGroup}'s idea: a file heading, and what is under it. */
export const EverywhereGroup = Schema.Struct({
  file: Schema.String,
  rows: Schema.Array(Row),
})
export type EverywhereGroup = typeof EverywhereGroup.Type

/**
 * ONE DOCUMENT THIS QUERY FOUND, as `/search` draws it.
 *
 * `./searching.ts`'s `DocumentHit` minus the ranking it was built for — the
 * same four fields, because a document row here and a document row in an
 * agent's `search_nodes` answer must say the same things about the same file.
 * It is re-declared rather than imported for exactly one reason: that one is a
 * member of a `SearchHit` union whose other arm is a whole situated record, and
 * a page that carried the union would be inviting a caller to switch on a kind
 * this page can never have.
 */
export const FoundDocument = Schema.Struct({
  at: AtDocument,
  /** What the file is CALLED — its own face's title, so this row, the
   *  document's page and `list_documents` say one name. */
  title: Schema.String,
  /** Which of the three document fields carried the strongest match — ABSENT
   *  for a query that named no words, on the format's own rule for absence. */
  matched: Schema.optionalKey(Schema.Literals(DOCUMENT_FIELDS)),
  /** The named facts the file writes about itself — its frontmatter. Absent
   *  for a file that wrote none. */
  props: Schema.optionalKey(Face.fields.props),
  /** The keys a `prop:` clause selected it on, in the file's own spelling. */
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type FoundDocument = typeof FoundDocument.Type

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
  documents: Schema.Array(FoundDocument),
  /** How many NODES the query selected in the whole directory — NEVER cut,
   *  which is what makes the cap sayable. */
  matches: Schema.Int,
  /** How many of those the groups below actually draw — equal to `matches`
   *  until {@link EVERYWHERE_LIMIT} bites, and the smaller of the two after. */
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
  // THE CAP, in the set's own file-then-line order, so what is dropped is the
  // tail of the directory rather than a sample of it — and the number above it
  // is the whole answer.
  const selected = new Set<string>()
  for (const one of found) {
    if (selected.size >= EVERYWHERE_LIMIT) break
    selected.add(one.at.node.id)
  }

  const groups: Array<EverywhereGroup> = []
  for (const path of documents) {
    if (fileKind(path.path) !== "outline") continue
    // THE FILE'S OWN TREE, pruned exactly as a filtered page prunes itself. A
    // mirror of a matching node survives wherever it is drawn, which is
    // `keeping`'s rule and the reason one node can be a row in two groups —
    // places, where {@link Everywhere.drawn} counts nodes.
    const rows = keeping(rowsOf(derived, path.path), selected)
    if (rows.length > 0) groups.push({ file: path.path, rows })
  }

  return {
    kind: "search",
    text,
    groups,
    documents: foundDocuments(documents, filter),
    matches: found.length,
    drawn: selected.size,
  }
}

/** The other half of the directory, asked the same question — `.md` and `.html`
 *  alike, in the set's own path order. No ranking, for the reason the rows have
 *  none: nothing here is choosing which few to show. */
const foundDocuments = (
  documents: ReadonlyArray<Document>,
  filter: Filter,
): ReadonlyArray<FoundDocument> => {
  const bodied = documents.filter((one): one is Bodied => one.kind !== "outline")
  return matchingDocuments(bodied, filter).map((selected): FoundDocument => {
    // Through `heldCustom` for the reason the ops layer's own hit goes through
    // it: it puts the keys in the FILE's canonical order, which is the order a
    // record's `custom` already arrives in, so one open map is not drawn two
    // ways inside one answer.
    const props = heldCustom(selected.at.props as Custom)
    return {
      at: { kind: "document", path: selected.at.path },
      title: selected.at.title,
      ...(selected.match.field === null ? {} : { matched: selected.match.field }),
      ...(nothing(props) ? {} : { props }),
      ...(selected.match.props.length === 0 ? {} : { matchedProps: selected.match.props }),
    }
  })
}
