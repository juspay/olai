/** Typed application client for callers that intentionally consume Olai's
 * complete bundle. The generic dispatch builder stays schema-parameterized. */
import { surface } from "./surface.ts"
import { clientOn as on, clientOver as over, type SurfaceClient } from "@olai/surface/client"
import type { SurfaceDispatch } from "@kolu/surface/link"
export type OlaiSurfaceClient = SurfaceClient<typeof surface.spec>
export const clientOn = (dispatch: SurfaceDispatch): OlaiSurfaceClient => on(surface, dispatch)
export const clientOver = (bound: Parameters<typeof over>[1], face: Parameters<typeof over>[2]): OlaiSurfaceClient => over(surface, bound, face)
