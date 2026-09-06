/** MCP consumes the contracts of the capabilities its tools project. This
 * catalogue belongs to that consumer, not the permanent host. Live dispatch
 * still resolves and authorizes the current provider generation per call. */
import { defineSurface } from "@kolu/surface/define"
import { clientOn as on, clientOver as over, type SurfaceClient } from "@olai/surface/client"
import type { SurfaceDispatch } from "@kolu/surface/link"
import { surface as outlines } from "olai-plugin-outlines/surface"
import { surface as markdown } from "olai-plugin-markdown/surface"
import { surface as files } from "olai-plugin-files/surface"
import { surface as search } from "olai-plugin-search/surface"
import { surface as definitions } from "olai-plugin-vault-plugins/surface"
const toolContract = defineSurface({
  procedures: {
    search: search.spec.procedures.search,
    plugins: definitions.spec.procedures.plugins,
    ops: { ...outlines.spec.procedures.ops, ...markdown.spec.procedures.ops, ...files.spec.procedures.ops },
  },
})
export type McpClient = SurfaceClient<typeof toolContract.spec>
export const clientOn = (dispatch: SurfaceDispatch): McpClient => on(toolContract, dispatch)

export const clientOver = (bound: Parameters<typeof over>[1], face: Parameters<typeof over>[2]): McpClient => over(toolContract, bound, face)
