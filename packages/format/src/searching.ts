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
 */

import { Schema } from "effect"

import { MARKS } from "./node.ts"

/**
 * One node, SITUATED — the shape every read of the set answers with.
 *
 * Flattened on purpose, and not a {@link Located}: a caller of a query wants
 * the node's facts beside where it lives, not a record nested under a file and
 * a line. `@olai/ops` builds one with `foundOf` and hangs its other answers off
 * it (`Detail`, `Subtree`, `Placed`), which is why the type is here rather than
 * only the hit below.
 */
export const Found = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** Where a person is pointed. Relative to the served directory, 1-based. */
  file: Schema.String,
  line: Schema.Int,
  /** The mark the node carries — a mirror's being its target's, since that is
   *  what it shows. ABSENT when it carries none: nobody marked it, so it is a
   *  bullet rather than a task nobody has started. */
  status: Schema.optionalKey(Schema.Literals(MARKS)),
  /** The canonical ancestor titles, outermost first. What makes a bare title
   *  like "order" mean something in a list of strangers. */
  path: Schema.Array(Schema.String),
  /** Free cross-references this node carries, as target ids. Absent when the
   *  node has none — so a reader can traverse without a second read, and a node
   *  that does not point anywhere does not pretend to. */
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  /** What this node must come AFTER, as target ids — the edges it carries
   *  itself, exactly as they are written.
   *
   *  Here for the same reason `see` is, and now for a second one: `set_after`
   *  removes a target BY ID, so a reader that could not see the list could only
   *  change it by guessing. Not the derived blockedness — what is standing in
   *  the way right now is a question about marks, and this is what the record
   *  says. */
  after: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type Found = typeof Found.Type

/** One hit: a situated node, plus the only thing about it that is a fact about
 *  the QUERY rather than about the record — which field carried the strongest
 *  match, so a caller can say why this came back instead of leaving a reader to
 *  guess. */
export const SearchHit = Schema.Struct({
  ...Found.fields,
  matched: Schema.Literals(["title", "id", "tag", "desc"]),
})
export type SearchHit = typeof SearchHit.Type

export const SearchAnswer = Schema.Struct({
  hits: Schema.Array(SearchHit),
  /** How many nodes matched in all. `hits` is capped; this is not, so "twelve
   *  of ninety" is sayable. */
  total: Schema.Int,
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
 * and a caller that is a text box.
 */
export const SearchRequest = Schema.Struct({
  text: Schema.String.annotate({
    description:
      "Words to look for. Case-folded substrings, no operators: every word must appear somewhere in the same node.",
  }),
  limit: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many hits to return. Default ${DEFAULT_SEARCH_LIMIT}; the total is reported either way.`,
    }),
  ),
})
export type SearchRequest = typeof SearchRequest.Type
