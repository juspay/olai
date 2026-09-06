/** The typed in-process client of the declared surface. Both core's writer
 * binding and transport tool projections use this same face; it opens no
 * listener and acquires no protocol server. */

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

/**
 * The collection READ verbs, typed off a spec.
 *
 * The framework's {@link SurfaceReadFace} deliberately declines collections: it
 * exists for a PROJECTION's `deps`, which consumes cells and streams and never
 * walks a collection. This face does — the adapter reads `outlines.keys` for the
 * key set and `outlines.get({ key })` for one file — so the two read verbs are
 * spelled here, in the shape and on the sides `buildSurfaceFace` actually mints
 * them. Keys and values are DECODED on both legs: a collection key is an
 * identity in our own key set, not a pure forwarded argument.
 *
 * Lifted from the same declaration in kolu's `@kolu/padi`, which is the
 * sanctioned pattern rather than a coincidence — see {@link OlaiSurfaceClient}.
 */
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

/**
 * olai's surface as a CLIENT sees it — spec-derived, so a schema edit is a
 * compile error here rather than a runtime surprise.
 *
 * This exists because `buildSurfaceFace` types its member leaves `unknown`: the
 * face is structural by design, and re-materializing the precise client type
 * inside the framework overflows TypeScript's union budget (kolu's documented
 * TS2590 dodge). Asking upstream to widen its own client type was the wrong fix
 * and was declined for exactly that reason. The right one is this: each consumer
 * declares the narrow face it actually calls, the way `@kolu/padi` declares
 * `PadiSurfaceClient`, and the framework-forced structural cast lives in ONE
 * named place — {@link clientOver} — instead of at every call site.
 *
 * The PROCEDURES need nothing added, which is worth saying because the tools
 * call them now ({@link ./tools.ts} projects `@olai/ops`' table over this
 * client rather than over a local `Ops`). {@link SurfaceReadFace}'s name
 * undersells it: its last mapped block is over `S["procedures"]`, with the
 * four-arm input/output ladder and the declared error union. A local re-spelling
 * of that was written here first and deleted — it type-checked, so it looked
 * harmless, and it had already drifted on the side that matters: the framework
 * mints a procedure on the ENCODED input and the copy took the decoded one.
 */
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

/** The in-process case: dispatch straight at the handlers this process bound.
 *  No wire under it and that is the point — the same consumer code runs against
 *  a socket-served surface, so what an agent reads and writes here and what it
 *  would read and write attached are the same values by construction.
 *
 *  GATED BY THE AGENT FACE, which is the reason `restrictHandlers` is
 *  exported upstream for hand-built serve paths. Without it an HTTP client
 *  would reach members a browser is refused — or the other way around —
 *  and a tool that worked in a terminal would fail on a directory that
 *  happened to have a browser open on it. It costs nothing: the adapter is
 *  the only caller, and it asks for what the map already grants.
 *
 *  IT TAKES THE GROUP AND THE FACE rather than reading either off `@olai/surface`
 *  and `../faces.ts`, and it has to: what this process serves is olai's surface
 *  FUSED with whichever plugin siblings it composed, and `restrictHandlers`
 *  proves an exposure describes the group it is applied to as a set EQUALITY —
 *  so a gate built from olai's own surface over a fused record refuses at boot,
 *  naming every sibling tag it cannot account for. That is the right failure and
 *  the reason both halves arrive together from the one place that composed them
 *  (`../runtime.ts`'s `bind`, which returns the faces beside the group).
 *
 *  The TYPED face above it stays olai's own spec, and that is not an
 *  inconsistency: what an agent calls through this client is core's members, and
 *  a plugin's are denied by the face it is gated with. */
export const clientOver = <S extends SurfaceSpec>(
  surface: Surface<S>,
  bound: Pick<Bound, "group" | "handlers">,
  face: FaceExposure,
): SurfaceClient<S> => {
  const handlers = restrictHandlers(bound.group, bound.handlers, face)
  return clientOn(surface, directDispatch({ handlers }))
}
