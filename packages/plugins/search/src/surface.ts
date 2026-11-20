import { OpFailure } from "@olai/format"
import { defineSurface } from "@kolu/surface/define"
import { SearchAnswer, SearchRequest } from "@olai/format"
export const surface = defineSurface({
streams: {
    searchResults: {
      inputSchema: SearchRequest,
      outputSchema: SearchAnswer,
    }
},
procedures: {
    search: {
      nodes: {
        input: SearchRequest,
        output: SearchAnswer,
        error: OpFailure,
      },
    }
}
})

export const faces = { browser: { searchResults: "resource", "search.nodes": "tool" }, agent: { "search.nodes": "tool" } } as const
