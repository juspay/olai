import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers, type FaceExposure } from "@kolu/surface/expose"
import { isReservedSurfaceTag, scopeSiblingTag } from "@kolu/surface/define"
import { brandDirectDispatch } from "@kolu/surface/link"
import { ToolFailure } from "@kolu/surface-mcp"
import { Effect, Stream } from "effect"
import { writerAt, type Bound } from "./authority.ts"

/** The served generation, read afresh per call — never closed over. */
export type Reading = () => Bound & { readonly expose: FaceExposure }

/** A reserved tag passes through untouched: `system/live`, `system/identity` and
 *  `system/clockNow` exist on EVERY surface and belong to the composition ROOT
 *  here, so scoping one would send a heartbeat to a sibling. */
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
