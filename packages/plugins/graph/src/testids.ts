/** Stable DOM identifiers owned by this renderer. Shared consumers import
 * this static contract; no provider state or activation is loaded with it.
 *
 * WHAT EACH ONE CARRIES — the vertex's `data-key` is the printed address, so
 * a suite asserts against the same spelling the URL holds; the edge's
 * `data-ways` are the strongest-first list look-up declined to compress. */
export const TESTID = {
  /** The page, its live camera geometry (`data-scale`, `data-centre-key`,
   *  `data-held`). */
  graphPage: "graph-page",
  /** The measured drawing surface the dots sit over. */
  graphCanvas: "graph-canvas",
  /** One dot: `data-key`, `data-kind`, `data-centre`, `data-hops`,
   *  `data-labelled`. */
  graphVertex: "graph-vertex",
  /** One arrow: `data-from`, `data-to`, `data-ways`. */
  graphEdge: "graph-edge",
  /** One grouping label: `data-file`. */
  graphFile: "graph-file",
  /** The hovered or focused vertex's caption. */
  graphCaption: "graph-caption",
  /** The caption's own re-centre control. */
  graphCentreHere: "graph-centre-here",
  /** The hop horizon's two-segment control: `data-hops`. */
  graphHorizon: "graph-horizon",
  /** The four ways and the two dot shapes, drawn once. */
  graphLegend: "graph-legend",
  /** An empty arm's sentence: `data-reason`. */
  graphEmpty: "graph-empty",
  /** The two camera-steps out and in, and the camera home. */
  graphCloser: "graph-closer",
  graphFurther: "graph-further",
  graphFit: "graph-fit",
  /** The sidebar's door. */
  graphLink: "graph-link",
  /** The palette's item. */
  graphPalette: "graph-palette",
  /** The quiet door under a zoomed node's properties. */
  nodeGraphDoor: "node-graph-door",
  /** The announced label count: `data-named`, `data-drawn`. */
  graphNamed: "graph-named",
} as const

export type TestId = (typeof TESTID)[keyof typeof TESTID]

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/graph": OwnedTestIds }
}
