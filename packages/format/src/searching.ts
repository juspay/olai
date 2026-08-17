/**
 * What a search ASKS and what one hit SAYS.
 *
 * Data, and nothing but: there is no matcher in this file and no way to reach
 * one from it. It is here for the reason `./committing.ts` is, and the argument
 * is that file's word for word — this package is the floor both the ops layer
 * and the wire spec stand on, and a vocabulary spelled in either of those would
 * have to be spelled again in the other. `@olai/ops` PRODUCES these values
 * (`Query.search`, over one reading of one snapshot), `@olai/surface` CARRIES
 * them (the `search.nodes` procedure the ⌘K palette calls), the browser DRAWS
 * them, an agent reads the identical value off `search_nodes`, and none of the
 * four has to agree with the others by memory.
 *
 * **It was spelled twice, and the two were free to drift.** The ops layer had
 * `Found`/`Hit`/`Search` as TypeScript, the wire spec had
 * `SearchHit`/`SearchAnswer` as Effect Schema, and `@olai/surface`'s own header
 * claimed a field added to one was a compile error on the other. It was not:
 * adding a field to the ops-side `Found` and producing it type-checked clean
 * across every package, after which `search_nodes` answered an agent with it
 * and the palette's procedure — encoding against a schema that had never heard
 * of it — dropped it. An agent and a person searching the same words in the
 * same directory, looking at different rows. One declaration is the fix; a
 * fence over two declarations was the fallback, and this package existing is
 * why it was not needed.
 *
 * **Why the SHAPE lives here and the RANKING does not.** Every field of a hit
 * is a statement about records in this package's own vocabulary — an id, a
 * title, a `file:line`, a {@link Status}, the ancestor titles `ancestorsOf`
 * walks, the edge lists a record carries. Which node matches, how hits are
 * ordered, and which field carried a match are questions about a QUERY, and
 * they stay in `@olai/ops` where the matcher is. So this is the same division
 * `./committing.ts` keeps: the shape of what is pending is here, and the survey
 * that produces one is not.
 *
 * **{@link Found} is next door**, in `./reading.ts`, and started here. It is
 * the atom of EVERY read — the node a detail, a subtree and a curated list's
 * row are each built out of, not only a hit — so the module named for the read
 * vocabulary is where it belongs, and this one imports it like any other
 * caller. What is left here is exactly what a QUERY adds to it.
 */

import { Schema } from "effect"

import { Refusal, SEARCH_FIELDS } from "./filter.ts"
import { Found } from "./reading.ts"

/** One hit: a situated node, plus the only thing about it that is a fact about
 *  the QUERY rather than about the record — which field carried the strongest
 *  match, so a caller can say why this came back instead of leaving a reader to
 *  guess. */
export const SearchHit = Schema.Struct({
  ...Found.fields,
  /** ABSENT when the query named no words at all: `is:done` selects a node by a
   *  field test, and no title, id, tag or note carried it. Saying one of them
   *  did would be an answer invented to fill a slot — the same rule `status`
   *  above follows, rather than a fifth word meaning "nothing".
   *
   *  The four are `./filter.ts`'s own list, because which fields a word is
   *  looked for in is the matcher's fact and this is only where it is reported. */
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
  /**
   * The custom keys a `prop:` clause selected this node on, in the node's own
   * spelling. ABSENT for every query that named no property.
   *
   * A SIBLING of `matched` rather than a fifth value of it, ruled on this PR
   * and argued where the matcher produces it (`./filter.ts`'s `Match.props`).
   * The short of it: the two can both be true at once — `cabinets
   * prop:agent=claude-opus` matched on the title AND on the agent — so one slot
   * would have to drop whichever a precedence rule nobody asked for preferred;
   * `matched`'s four values are a CLOSED list of places a word is looked for,
   * weighted against each other, where a property key is an open namespace
   * somebody invented; and `matched` being absent already MEANS "the query
   * named no words", which a fifth value would quietly stop meaning.
   *
   * What it is FOR is the row: a hit carries the whole `custom` map, and this
   * says which of those keys is the answer to "why is this here" — so a reader
   * sees the property they searched by first rather than hunting it in a line
   * of others.
   */
  matchedProps: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type SearchHit = typeof SearchHit.Type

export const SearchAnswer = Schema.Struct({
  hits: Schema.Array(SearchHit),
  /** How many nodes matched in all. `hits` is capped; this is not, so "twelve
   *  of ninety" is sayable. */
  total: Schema.Int,
  /** What the grammar could not read, in its own words — a known operator with
   *  an unknown value (`is:open`). ABSENT for every query it could read.
   *
   *  It travels rather than being swallowed because a door that answered
   *  `is:open` with an empty list and no reason is the silent failure
   *  HACKING.md forbids: the reader typed an operator, and the honest answer is
   *  which values it takes. The filter over the tree draws its own because it
   *  parses for itself; these are for the three doors that ask the server. */
  refusals: Schema.optionalKey(Schema.Array(Refusal)),
})
export type SearchAnswer = typeof SearchAnswer.Type

/** How many hits an unasked-for limit means. Here rather than beside the
 *  matcher because it is part of what an absent `limit` MEANS, which is a fact
 *  about the request — and because the sentence below quotes it, so a number
 *  changed in one place would otherwise leave every agent's JSON Schema
 *  advertising the old one. */
export const DEFAULT_SEARCH_LIMIT = 12

/**
 * What a search asks.
 *
 * The field prose is agent-facing — it becomes the JSON Schema `search_nodes`
 * advertises — and it describes the matcher's own rule rather than a wire
 * convention, which is why it can be written once for a caller that is a model
 * and a caller that is a text box. `text` is the whole GRAMMAR
 * ({@link parseFilter}), so the sentence documenting it is the one place the
 * operators are spelled out for a reader who is not looking at the parser.
 */
export const SearchRequest = Schema.Struct({
  text: Schema.String.annotate({
    description:
      "What to look for. Case-folded substring WORDS — every word must appear somewhere in the same node — composed with OPERATORS:\n" +
      "- `is:done` / `is:doing` / `is:todo` — the mark the node stores (never a derived one). `is:marked` is any of the three; `is:archived` reaches what was put away.\n" +
      "- `is:blocked` — the node is WAITING: something it must come after is a task that is not finished. Derived, and the same derivation the app draws a blocked row with, so it reads the ORDERING GRAPH rather than the field — an edge spelled `blocks` on the other record counts, and a node can be blocked while carrying no `after` of its own (`has:after` is the question about the field). A node with no mark is not blocked (a bullet is not work), a target with no mark blocks nothing, and archived work is out of it at both ends. `-is:blocked` takes the waiting ones back out.\n" +
      "- `has:desc` / `has:date` / `has:see` / `has:after` / `has:doc` — a field the record carries.\n" +
      "- `date:2026-08-10`, `date:2026-08`, `date:2026`, `date:2026-08-01..2026-08-14`, `date:..2026-08-10`, `date:2026-08-10..` — the two dates a journal reads: what the node is scheduled for, and when it was finished.\n" +
      "- `prop:pr` / `prop:agent=claude-opus` — a CUSTOM property the node carries, by key or by key and value. Reads the `custom` map only: a field is not a property, so `prop:done` and `prop:date=…` match nothing. A list value matches on any member.\n" +
      "- `-` before any word or operator negates it: `#home -is:done`.\n" +
      "A `#tag` or `@mention` is an ordinary word — tags are indexed bare and as written. An unknown value for a known operator is REFUSED rather than searched for as text; a colon after anything else (`TODO:`) is just a word.\n" +
      "ARCHIVED NODES ARE EXCLUDED unless the query says `is:archived`.",
  }),
  limit: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many hits to return. Default ${DEFAULT_SEARCH_LIMIT}; the total is reported either way.`,
    }),
  ),
  /**
   * The two scopes a tree page can BE, and they are on the REQUEST rather than
   * on any one caller for the reason this whole module exists: the browser's
   * filter narrows to one outline or to one node's subtree, so a door that
   * could not ask for that narrowing would be answering a smaller question than
   * the other one.
   */
  file: Schema.optionalKey(
    Schema.String.annotate({
      description: "Only nodes in this outline, by its relative path.",
    }),
  ),
  under: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "Only this node and everything beneath it, by id — the same scoping a person gets by filtering a zoomed page.",
    }),
  ),
})
export type SearchRequest = typeof SearchRequest.Type
