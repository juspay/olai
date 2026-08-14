/**
 * Search, as the wire speaks it — the browser's door to the ONE reading.
 *
 * The MCP face's `search_nodes` and the palette must answer identically for
 * the same words (HACKING.md: MCP and Web ops must be consistent), and that is
 * made structural rather than aspirational in two places, of which this file is
 * the second.
 *
 * **One matcher.** Both are callers of `@olai/ops`' `Query.search`, over the
 * same `Reading`. The browser does hold every node (the `outlines` collection)
 * and could grep them itself; it deliberately does not, because a client-side
 * matcher would be a second implementation of ranking — and the first place the
 * two faces of search quietly stopped being the same product.
 *
 * **And one SHAPE, which is what this file is now.** These are `@olai/format`'s
 * declarations, re-exported rather than re-declared, exactly as `GitState`,
 * `Pending` and `CommitRequest` are: one vocabulary on the floor that this spec
 * and the ops layer both stand on, so there is no second spelling to drift.
 *
 * They used to be re-declared here, and the header used to claim that could not
 * drift — that returning `Query.search`'s value where this schema's type was
 * demanded made a field added to one side a compile error on the other. That
 * was assignability, which is precisely the check that misses it: a field added
 * to the ops-side hit and produced type-checked clean across every package,
 * reached an agent through `search_nodes`, and was dropped by this schema's
 * encoder on the way to a browser. Two faces, one matcher, different rows.
 *
 * A PROCEDURE and not a collection or cell: a search is a question with an
 * answer, not a value the server owns — there is nothing to subscribe to, and
 * ten open tabs asking ten different things is exactly what a procedure is.
 */

export {
  /** How many hits an absent `limit` means. The palette asks for fewer,
   *  because a modal shows fewer. */
  DEFAULT_SEARCH_LIMIT,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "@olai/format"
