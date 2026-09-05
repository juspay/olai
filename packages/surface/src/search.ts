/**
 * Search, as the wire speaks it — the browser's door to the ONE reading.
 *
 * The MCP face's `search_nodes` and the three doors a person types into must
 * answer identically for the same query (MCP and Web ops must be
 * consistent), and that is made structural rather than aspirational in three
 * places, of which this file is the third.
 *
 * **One grammar.** `@olai/format`'s `parseFilter` reads the words AND the
 * operators, for every door — including the filter over the tree, which parses
 * in the browser and never asks the server at all. So `is:done` means one thing
 * everywhere because there is one thing for it to mean.
 *
 * **One matcher.** Every door that lists hits is a caller of `@olai/ops`'
 * `Query.search`, over the same `Reading`, and the page filter is a caller of
 * the other half of the same matcher (`Query.narrowing`, which is a reading of
 * a page and so is declared in {@link ./narrowing.ts} rather than here). A
 * client-side ranking would have been a second implementation of it — and the
 * first place the faces of search quietly stopped being the same product. That
 * used to be restraint over a browser holding every node; since
 * `search-server-side` the browser holds no vault to grep, so what is left of
 * the sentence is the rule rather than the discipline.
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
 * The filter grammar is what that property is FOR, and it arrived one day
 * later: `file`, `under`, an optional `matched` and the `refusals` list are all
 * fields the old arrangement would have needed spelling twice and keeping in
 * step by hand. They are spelled once.
 *
 * The one-shot procedure and the browser’s `searchResults` stream use this
 * same request and answer. An open search is keyed by its query and refreshes
 * when vault revisions change the matching results.
 */

export {
  /** How many hits an absent `limit` means. The palette asks for fewer,
   *  because a modal shows fewer. */
  DEFAULT_SEARCH_LIMIT,
  /** What the grammar could not read, quoted as the reader typed it — carried
   *  on the answer because three of the four doors ask the server, and a door
   *  that answered `is:open` with an empty list and no reason would be the
   *  one place a typo looks like an empty directory. */
  /** ONE HIT ON A DOCUMENT, and one on a record, and the narrowing between
   *  them: a search answers with both, and a door that draws only one says so
   *  in its type ({@link isNodeHit}). */
  DocumentHit,
  isNodeHit,
  /** ONE NODE A PAGE'S FILTER SELECTED — the other shape the same matcher
   *  answers in, for the box that narrows what is already on screen rather than
   *  listing hits beside it. What ASKS for a list of them is {@link
   *  ./narrowing.ts}, which is a reading of a page rather than a search. */
  MatchedNode,
  NodeHit,
  Refusal,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "@olai/format"
