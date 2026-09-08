import { defineSurface } from "@kolu/surface/define"
import { GraphPageRequest, PageReading } from "@olai/format"

export const name = "graph"

/**
 * THE DECLARATION EVERYTHING THAT COMPOSES OR READS THIS ROW PULLS IN
 * STATICALLY — no `solid-js`, no `node:` builtins, because this file is the
 * wire identity and a process that renders nothing must be able to import it.
 *
 * One stream, `graph`: a page reading narrowed to the graph arms at the DOOR
 * ({@link GraphPageRequest} is `PageRequest` filter-checked down to
 * `kind: "graph"`), so a member promising only what its owner computes is a
 * type error here rather than a refusal one frame in.
 */
export const surface = defineSurface({
  streams: {
    graph: { inputSchema: GraphPageRequest, outputSchema: PageReading, arrayKey: "key" },
  },
})

/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * THE BROWSER'S, and there is no `agent` map at all (`journal/src/wire.ts`'s
 * paragraph argues the grammar): a live picture of every reference is a paint
 * instruction for a person looking at a screen. An agent asking the same
 * question asks `search_nodes` or the directory walk and is answered with the
 * records, which is the thing it can act on.
 */
export const faces = {
  browser: {
    graph: "resource",
  },
} as const
