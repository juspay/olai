/**
 * What the two kinds of edge look like, as values — and what they are called.
 *
 * `../backlinks/way.ts` for the same table one direction over, and for the same
 * reason that file gives: what a relation is CALLED and how it is drawn are
 * facts about the relation, so they live where a test can ask without a browser
 * and where renaming one cannot leave a component saying the old thing.
 *
 * KEYED BY `Way`, which is `@olai/format`'s own closed list, so the table is
 * total ACROSS the package boundary: a third way added where the rulings live
 * (`format/src/backlinks.ts`) is a compile error here rather than a legend with
 * two rows out of three.
 *
 * ## Why one of them is accented and the other is not
 *
 * The house is quiet on purpose (`../tone.ts`): a mark does not colour a title,
 * because a page where half the rows are under way would be a page of blue. A
 * DIAGRAM is the case that argument does not reach — it has no words to be
 * quiet with, and two kinds of line that differ only in dashes is a picture a
 * reader has to decode rather than read. So the accent carries the distinction
 * that matters: a `see` is an edge somebody wrote with a verb, and it is drawn
 * in the ink this app reserves for deliberate things; a mention is a word in a
 * sentence, and it is drawn quiet and dashed. Both come from theme tokens, so
 * all fifteen palettes follow.
 *
 * The FOCUS wears the same accent, and that is one claim rather than two: the
 * node you asked about and the references somebody made on purpose are the two
 * deliberate things on the page. Everything else — every other dot, every
 * label, every file name — is ink and muted.
 */

import { type Way, WAYS } from "@olai/format"

import { type TestId, TESTID } from "../testids.ts"

/** How one kind of edge is drawn, and what it is called on the legend. */
export interface EdgeLook {
  readonly way: Way
  /** The legend's words — a phrase about the RELATION, the way
   *  `../backlinks/way.ts`'s labels are, read along the arrow: "sees". */
  readonly label: string
  /**
   * The line's ink and its ARROWHEAD's, as theme-token utilities — one pair on
   * one record, because they are one fact ("what colour is this kind of
   * reference drawn in") and a side table beside this one was that fact held
   * together by a comment.
   *
   * Two literal fields rather than one token name the two are built from, and
   * that is Tailwind's constraint rather than a preference: the scanner emits
   * the classes it can SEE, so a `stroke-${ink}` template would emit nothing
   * and the arrows would have no colour at all.
   *
   * Never a hex either way: a colour written here would be right in one palette
   * out of fifteen.
   */
  readonly stroke: string
  readonly arrowFill: string
  /** `stroke-dasharray`, or `undefined` for a solid line. A raw attribute
   *  rather than a utility because Tailwind has none for it, and a dash pattern
   *  is a length in the SVG's own units rather than a token. */
  readonly dashes: string | undefined
  /** The `<marker>` this kind's arrowheads come from — declared once per kind
   *  in the canvas's `<defs>`, since a marker cannot inherit the stroke of the
   *  line it caps in every engine this app runs in. */
  readonly arrow: string
  /** What the legend row is called to the browser tests. */
  readonly testid: TestId
}

/** The table WITHOUT the way each row is already keyed by: a `Record<Way, …>`
 *  does not tie a value's own `way` to its key, so `see: { way: "mention" }`
 *  type-checked while this carried both. The key is put back below, where the
 *  array is built. */
const LOOK: Record<Way, Omit<EdgeLook, "way">> = {
  see: {
    label: "sees",
    stroke: "stroke-accent",
    arrowFill: "fill-accent",
    dashes: undefined,
    arrow: "graph-arrow-see",
    testid: TESTID.graphLegendSee,
  },
  mention: {
    label: "mentions",
    stroke: "stroke-muted",
    arrowFill: "fill-muted",
    dashes: "6 5",
    arrow: "graph-arrow-mention",
    testid: TESTID.graphLegendMention,
  },
}

/**
 * Both of them, in the order the format says them — the edge first, the prose
 * after it — READ rather than re-declared, so the legend and an edge's own
 * `ways` array come out the same way round.
 */
export const EDGE_LOOKS: ReadonlyArray<EdgeLook> = WAYS.map((way) => ({
  way,
  ...LOOK[way],
}))

/**
 * How ONE edge is drawn, when it is both.
 *
 * A record that points at a node AND names it in prose is one relationship, and
 * the format hands it back as one edge carrying both ways ({@link WAYS} order).
 * A line cannot be solid and dashed, so the leading way wins — which is the
 * edge somebody wrote with a verb, because that is the stronger claim and the
 * one the reader is being told about. What the pair says in full is on the
 * arrow's `data-ways`, and in words on the node's own page — where both
 * relations are already drawn as rows (`../backlinks/`, `../edges/`).
 */
export const lookOf = (ways: ReadonlyArray<Way>): EdgeLook =>
  EDGE_LOOKS.find((look) => ways.includes(look.way)) ?? EDGE_LOOKS[0]!

