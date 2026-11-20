import { buildSurfaceFace, type StreamingProcedure } from "@kolu/surface/client"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers } from "@kolu/surface/expose"
import type { SurfaceDispatch } from "@kolu/surface/link"
import type { SurfaceReadFace } from "@kolu/surface/project"

import type { FaceExposure } from "@kolu/surface/expose"

import type { SurfaceHandlers } from "@kolu/surface/server"
import type { Rpc, RpcGroup } from "effect/rpc"
type Bound = { readonly group: RpcGroup.RpcGroup<Rpc.Any>; readonly handlers: SurfaceHandlers }

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

export type SurfaceClient<S extends SurfaceSpec> = {
  readonly surface:
    & SurfaceReadFace<S>
    & SurfaceCollectionsReadFace<S>
}

export const clientOn = <S extends SurfaceSpec>(
  surface: Surface<S>,
  dispatch: SurfaceDispatch,
): SurfaceClient<S> =>
  buildSurfaceFace(surface, dispatch) as unknown as SurfaceClient<S>

export const clientOver = <S extends SurfaceSpec>(
  surface: Surface<S>,
  bound: Pick<Bound, "group" | "handlers">,
  face: FaceExposure,
): SurfaceClient<S> => {
  const handlers = restrictHandlers(bound.group, bound.handlers, face)
  return clientOn(surface, directDispatch({ handlers }))
}
