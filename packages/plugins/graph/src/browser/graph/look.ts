/**
 * What the four kinds of edge look like, as values — and what they are called.
 *
 * `backlinks.ts`'s `way.ts` one direction over for the first one, and for the
 * reason that file gives: what a relation is CALLED and how it is drawn are
 * facts about the relation, so they live where a test can ask without a
 * browser and where renaming one cannot leave a component saying the old
 * thing.
 *
 * KEYED BY `WayDrawn`, which is `@olai/format`'s own closed list
 * (`graph.ts`'s `WAYS_DRAWN`), so the table is total ACROSS the package
 * boundary: a fifth way added where the rulings live is a compile error here
 * rather than a legend with four rows out of five.
 *
 * ## The two strengths, and the one accent
 *
 * The house is quiet on purpose (`letterpress.ts` in the docs): a mark does
 * not colour a title, because a page where half the rows are under way would
 * be a page of blue. A DIAGRAM is the case that argument does not reach: it
 * has no words to be quiet with. But the four ways are not four colours —
 * they are TWO claims: a relationship somebody WROTE (`see`, and the `doc`
 * half of one) wears the accent this app reserves for deliberate things; a
 * word in a sentence (`link`, `mention`) is drawn quiet, the mention dashed
 * because the sentence never even claimed it. A file-full of links around a
 * planning row reads as one thing and not four.
 *
 * The CENTRE wears the accent too, and that is the same claim rather than a
 * second one: the vertex you asked about and the references somebody made on
 * purpose are the deliberate things on the page. Everything else — every
 * other dot, every label, every file name — is ink and muted.
 */

import { type WayDrawn, WAYS_DRAWN } from "@olai/format"

/** How one kind of edge is drawn, and what it is called on the legend. */
export interface EdgeLook {
  readonly way: WayDrawn
  /** The legend's words — a phrase about the RELATION, read along the arrow. */
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
   * Never a hex either way: a colour written here would be right in one
   * palette out of fifteen.
   */
  readonly stroke: string
  readonly arrowFill: string
  /** `stroke-dasharray`, or `undefined` for a solid line. A raw attribute
   *  rather than a utility because Tailwind has none for it, and a dash
   *  pattern is a length in the SVG's own units rather than a token. */
  readonly dashes: string | undefined
  /** The `<marker>` this way's arrowheads come from — declared once per way
   *  in the canvas's `<defs>`, since a marker cannot inherit the stroke of
   *  the line it caps in every engine this app runs in. */
  readonly arrow: string
  /** Hollow rather than filled: the `doc` of an attachment is the file half
   *  of one relationship, so its head reads as a destination rather than a
   *  claim. */
  readonly hollow: boolean
}

/** The table WITHOUT the way each row is already keyed by: a `Record<…>` does
 *  not tie a value's own `way` to its key, so `see: { way: "mention" }` would
 *  type-check while this carried both. The key is put back below, where the
 *  array is built. */
const LOOK: Record<WayDrawn, Omit<EdgeLook, "way">> = {
  see: {
    label: "sees",
    stroke: "stroke-accent",
    arrowFill: "fill-accent",
    dashes: undefined,
    arrow: "graph-arrow-see",
    hollow: false,

  },
  doc: {
    label: "is the doc of",
    stroke: "stroke-accent",
    arrowFill: "fill-accent",
    dashes: undefined,
    arrow: "graph-arrow-doc",
    hollow: true,

  },
  link: {
    label: "links to",
    stroke: "stroke-muted",
    arrowFill: "fill-muted",
    dashes: undefined,
    arrow: "graph-arrow-link",
    hollow: false,

  },
  mention: {
    label: "mentions",
    stroke: "stroke-muted",
    arrowFill: "fill-muted",
    dashes: "6 5",
    arrow: "graph-arrow-mention",
    hollow: false,

  },
}

/**
 * All of them, in the order the format says them — the written relations
 * first, the prose after it — READ rather than re-declared, so the legend
 * and an edge's own `ways` array come out the same way round.
 */
export const EDGE_LOOKS: ReadonlyArray<EdgeLook> = WAYS_DRAWN.map((way) => ({
  way,
  ...LOOK[way],
}))

/**
 * How ONE edge is drawn, when it carries more than one way.
 *
 * A record that points at a vertex AND names it in prose is one relationship,
 * and the format hands it back as one edge carrying the ways it holds
 * (`WAYS_DRAWN` order). A line cannot be solid and dashed, so the leading way
 * wins — the strongest claim the writer made, by this column's own ordering.
 * What the pair says in full is on the arrow's `data-ways`, and in words on
 * the vertex's own page, where both relations are already drawn as rows.
 */
export const lookOf = (ways: ReadonlyArray<WayDrawn>): EdgeLook =>
  EDGE_LOOKS.find((look) => ways.includes(look.way)) ?? EDGE_LOOKS[0]!
