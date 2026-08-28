/**
 * The page's NARROWING, as the wire speaks it — which of the rows in front of
 * somebody the query in the address selects.
 *
 * `./search.ts`'s three arguments hold here word for word, and this file exists
 * because the fourth is different: what a filter answers is not a search of the
 * directory. It was one — `search.matching`, a whole-vault walk answered with
 * every matching id in the corpus — and a filtered page re-asked it once per
 * published revision, because a filter is a STANDING view whose true answer
 * moves with every write. One bulk gesture on a 90,000-node vault cost nine of
 * those walks, one per frame, and no coalescing window in a browser collapses
 * them (measured in olai#290, built both ways, deleted).
 *
 * What the door was actually asked for is smaller than what it answered: every
 * reader of the answer is a membership test against a row the page already
 * draws. So the narrowing is a READING OF A PAGE — bounded by the page, asked
 * with the page's own request, and re-read on the same revision pulse the page
 * rides. The design is https://github.com/juspay/oss.olai/blob/main/olai/brainstorming/filter-rides-the-page.md.
 *
 * A STREAM and not a procedure, for {@link ./page.ts}'s reason: a stream is a
 * cell with an argument — read, listen, re-read on every published revision,
 * emit only when the answer moved — and both halves are what a filter needs.
 * Asked as a procedure it needed a GENERATION to re-ask on, which is the whole
 * of the defect: the generation moved on every frame, and so did the walk.
 *
 * A SECOND STREAM and not a field on {@link ./page.ts}'s, which is the one
 * judgement call in the design. A subscription re-opens whenever its input
 * notifies, so a query carried on the page's own request would re-send every
 * row of the page for each settled keystroke — ~104 kB on a 200-row outline,
 * per word typed. The page and its narrowing move on different clocks: the page
 * on the directory, the narrowing on the directory AND on a pair of hands.
 *
 * WHAT DELIBERATELY DOES NOT RIDE HERE is the READER'S OWN HIDING, unchanged:
 * done-visibility is a preference of this browser and it prunes FIRST, so the
 * server answers the selection and the page prunes by it. A server that pruned
 * would need the preference on the wire and still could not say how many
 * matches the preference held back.
 *
 * THE BROWSER'S ALONE (`@olai/server`'s `faces.ts`), like the member it
 * replaced and for the same reason: what comes back is a set of ids to look up,
 * useful only to somebody already looking at the rows. An agent asking which
 * nodes match asks `search_nodes`, and is answered with the nodes.
 */

/**
 * THE SHAPES, and not the equivalence beside them — `./page.ts`'s rule: a
 * stream does not declare an `equals` at all, the server supplies `isEqual`
 * where it binds the member, from the same floor.
 */
export {
  /** The words this page answers, and every node of it they select. */
  NarrowingAnswer,
  /** Which page, and what was typed into its box. */
  NarrowingRequest,
} from "@olai/format"
