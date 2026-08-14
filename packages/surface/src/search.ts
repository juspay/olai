/**
 * Search, as the wire speaks it — the browser's door to the ONE reading.
 *
 * The MCP face's `search_nodes` and the palette must answer identically for
 * the same words (HACKING.md: MCP and Web ops must be consistent), and the
 * way that is made structural rather than aspirational is this procedure:
 * both are callers of `@olai/ops`' `Query.search`, over the same `Reading`.
 * The browser does hold every node (the `outlines` collection) and could grep
 * them itself; it deliberately does not, because a client-side matcher would
 * be a second implementation of ranking — and the first place the two faces of
 * search quietly stopped being the same product.
 *
 * The shapes are the ops layer's own answers re-declared in schema, and the
 * two cannot drift: the procedure's implementation (`@olai/server`'s
 * `runtime.ts`) returns `Query.search`'s value where this schema's type is
 * demanded, so a field added to one side is a compile error on the other.
 *
 * A PROCEDURE and not a collection or cell: a search is a question with an
 * answer, not a value the server owns — there is nothing to subscribe to, and
 * ten open tabs asking ten different things is exactly what a procedure is.
 */

import { Schema } from "effect"

import { MARKS, SEARCH_FIELDS } from "@olai/format"

/** One hit, exactly as `Query.search` situates one: the node, where it
 *  lives, and which field carried the match. */
export const SearchHit = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
  line: Schema.Int,
  status: Schema.optionalKey(Schema.Literals(MARKS)),
  /** Ancestor titles, outermost first — what makes a bare title mean
   *  something in a list of strangers. */
  path: Schema.Array(Schema.String),
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  after: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Which field carried the words — ABSENT when the query named none, which
   *  a query of operators alone (`is:done`) does. Optional rather than a fifth
   *  word for "nothing", the same rule `status` above follows. */
  matched: Schema.optionalKey(Schema.Literals(SEARCH_FIELDS)),
})
export type SearchHit = typeof SearchHit.Type

/** A token the grammar knows the name of and not the value — `is:blocked` —
 *  with what that operator takes. */
export const SearchRefusal = Schema.Struct({
  token: Schema.String,
  reason: Schema.String,
})
export type SearchRefusal = typeof SearchRefusal.Type

export const SearchAnswer = Schema.Struct({
  hits: Schema.Array(SearchHit),
  /** Every node that matched, uncapped — so "twelve of ninety" is sayable. */
  total: Schema.Int,
  /** Why the answer is empty, when it is empty because the query could not be
   *  read. Absent for every query that could.
   *
   *  It is on the wire because a box that answered `is:blocked` with an empty
   *  list and no reason is the silent failure HACKING.md forbids — and because
   *  the operators are one grammar: the filter over the tree parses for itself
   *  and draws its own refusals, so a door that asked the server would
   *  otherwise be the one door where a typo looks like an empty directory. */
  refusals: Schema.optionalKey(Schema.Array(SearchRefusal)),
})
export type SearchAnswer = typeof SearchAnswer.Type

export const SearchRequest = Schema.Struct({
  /** Words and operators — one grammar, `@olai/format`'s `parseFilter`, which
   *  is also what the tree filter in the browser parses. */
  text: Schema.String,
  /** How many hits to return. The server defaults it (12); the palette asks
   *  for fewer because a modal shows fewer. */
  limit: Schema.optionalKey(Schema.Number),
  /** The two scopes a tree page can BE, spelled here for the reason the MCP
   *  tool spells them: the browser's filter narrows to one outline or to one
   *  node's subtree, and a door that could not ask for that narrowing would be
   *  a door answering a smaller question than the other one. */
  file: Schema.optionalKey(Schema.String),
  under: Schema.optionalKey(Schema.String),
})
export type SearchRequest = typeof SearchRequest.Type
