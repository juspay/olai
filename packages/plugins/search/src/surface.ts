/** search owns these wire descriptors as well as their live handlers.
 * The descriptor imports are inert schemas; loading this contract acquires no
 * runtime state. Stable root tags preserve clients without moving ownership
 * back into the host. */
import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { SearchAnswer, SearchRequest } from "@olai/format"
export const surface = defineSurface({
streams: {
/** An open search follows vault revisions until its query is dismissed. */
    searchResults: {
      inputSchema: SearchRequest,
      outputSchema: SearchAnswer,
    }
},
procedures: {
/** THE DOOR onto the one matcher for a caller that wants a LIST — the
     *  palette's search, the same reading `search_nodes` answers an agent with,
     *  reached as a question rather than re-implemented over nodes the browser
     *  no longer holds. See {@link ./search.ts} for why that restraint is the
     *  point. The other caller of that matcher is a PAGE, and it is not here:
     *  narrowing one is a reading of a page rather than a call, and it rides
     *  the revision pulse as a stream ({@link ./narrowing.ts}). */
    search: {
      nodes: {
        input: SearchRequest,
        output: SearchAnswer,
        error: OpFailure,
      },
    }
}
})

/**
 * WHICH FACE SEES WHAT — this row's whole grant, over this row's own spec.
 *
 * {@link search.nodes} IS THE ONE MEMBER IN THE TREE ON BOTH FACES UNCHANGED,
 * and that is the point of it rather than an oversight: it answers with NODES,
 * which is what an agent can act on and what the palette draws, so there is no
 * agent-specific version to write. Everywhere else the two faces differ, they
 * differ because one consumer wants a paint instruction and the other wants
 * something to act on (`@olai/surface/host`'s `hostFaces`).
 *
 * {@link searchResults} is the browser's alone for that same reason one step
 * on: it is the SAME reading delivered as a stream that follows vault
 * revisions until the query is dismissed. An agent asks its question once and
 * is answered; a subscription that re-answers while nobody is looking is a URI
 * published for nobody.
 */
export const faces = { browser: { searchResults: "resource", "search.nodes": "tool" }, agent: { "search.nodes": "tool" } } as const
