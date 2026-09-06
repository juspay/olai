/** A transport-owned dispatch resolves the current generation for each new
 * call. In-flight handlers retain their provider's normal revocation and drain
 * rules.
 *
 * ...AND SCOPES ITS TAGS TO ONE ROW. Every member on the wire carries its
 * owner's name since #546, and a per-sibling client face is built against that
 * row's STANDALONE spec — so its dispatch is wrapped through kolu's own
 * `scopeSiblingTag` and the face never learns it is scoped. A member whose row
 * is not standing has no tag to be routed to and is refused in the same words
 * an unexposed one is, which is "a tool leaves with its row" enforced at the
 * call rather than by a filter somebody keeps up to date. */
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers, type FaceExposure } from "@kolu/surface/expose"
import { isReservedSurfaceTag, scopeSiblingTag } from "@kolu/surface/define"
import { brandDirectDispatch } from "@kolu/surface/link"
import { ToolFailure } from "@kolu/surface-mcp"
import { Effect, Stream } from "effect"
import { writerAt, type Bound } from "./authority.ts"

/** The served generation, read afresh per call — never closed over, because a
 *  row that mounted since the last one is the whole point. */
export type Reading = () => Bound & { readonly expose: FaceExposure }

/**
 * ONE ROW'S DISPATCH: its own bare tags, put under its own name.
 *
 * A reserved tag passes through untouched. `system/live`, `system/identity` and
 * `system/clockNow` exist on EVERY surface and belong to the composition ROOT
 * here, so scoping one would send a heartbeat to a sibling.
 */
export const scopedTo = (
  read: Reading,
  caller: Parameters<typeof writerAt>[1],
  sibling: string,
) => {
  const current = () => {
    const bound = read()
    const handlers = restrictHandlers(bound.group, writerAt(bound, caller), bound.expose)
    return { handlers, dispatch: directDispatch({ handlers }) }
  }
  const unavailable = (tag: string) => new ToolFailure("The capability for this operation is not active.", { unavailable: tag })
  const at = (tag: string) => isReservedSurfaceTag(tag) ? tag : scopeSiblingTag(tag, sibling)
  return brandDirectDispatch({
    unary: (tag: string, payload: unknown) => Effect.suspend(() => {
      const scoped = at(tag)
      const value = current()
      return scoped in value.handlers ? value.dispatch.unary(scoped, payload) : Effect.fail(unavailable(tag))
    }),
    stream: (tag: string, payload: unknown) => Stream.unwrap(Effect.sync(() => {
      const scoped = at(tag)
      const value = current()
      return scoped in value.handlers ? value.dispatch.stream(scoped, payload) : Stream.fail(unavailable(tag))
    })),
  })
}
