/** Typed clients for an explicitly supplied surface contract. The caller owns
 * the contract and exposure; this adapter imports no application catalogue,
 * opens no listener, and acquires no protocol server. */

import { buildSurfaceFace, type StreamingProcedure } from "@kolu/surface/client"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers } from "@kolu/surface/expose"
import type { SurfaceDispatch } from "@kolu/surface/link"
import type { SurfaceReadFace } from "@kolu/surface/project"

import type { FaceExposure } from "@kolu/surface/expose"

import type { SurfaceHandlers } from "@kolu/surface/server"
import type { Rpc, RpcGroup } from "effect/unstable/rpc"
type Bound = { readonly group: RpcGroup.RpcGroup<Rpc.Any>; readonly handlers: SurfaceHandlers }

// ── The client, typed ────────────────────────────────────────────────────

/** Collections are absent from the framework's projection read face. Add the
 * two collection reads using the declared decoded key and value schemas, in
 * the shape that buildSurfaceFace actually constructs. */
type SurfaceCollectionsReadFace<S extends SurfaceSpec> = {
  [K in keyof S["collections"] & string]: {
    keys: StreamingProcedure<
      undefined,
      readonly NonNullable<S["collections"]>[K]["keySchema"]["Type"][]
    >
    get: StreamingProcedure<
      { key: NonNullable<S["collections"]>[K]["keySchema"]["Type"] },
      NonNullable<S["collections"]>[K]["schema"]["Type"]
    >
  }
}

/** Derive the caller's client from its own contract. Procedure inputs and
 * failures come directly from SurfaceReadFace, preserving the framework's
 * encoded input types and transport error union. The structural cast required
 * by buildSurfaceFace stays in clientOn rather than spreading to consumers. */
export type SurfaceClient<S extends SurfaceSpec> = {
  readonly surface:
    & SurfaceReadFace<S>
    & SurfaceCollectionsReadFace<S>
}

/** Build the typed face over any dispatch — the in-process one the HTTP
 *  route uses. THE one place the structural cast lives, so nothing
 *  downstream re-derives it. */
export const clientOn = <S extends SurfaceSpec>(
  surface: Surface<S>,
  dispatch: SurfaceDispatch,
): SurfaceClient<S> =>
  buildSurfaceFace(surface, dispatch) as unknown as SurfaceClient<S>

/** Bind an in-process client behind the caller's exposure. The group and face
 * must arrive together from composition: restrictHandlers checks the complete
 * composed group, including dynamically mounted siblings. The client's static
 * contract describes what this consumer calls; it grants no authority beyond
 * the supplied face. */
export const clientOver = <S extends SurfaceSpec>(
  surface: Surface<S>,
  bound: Pick<Bound, "group" | "handlers">,
  face: FaceExposure,
): SurfaceClient<S> => {
  const handlers = restrictHandlers(bound.group, bound.handlers, face)
  return clientOn(surface, directDispatch({ handlers }))
}
