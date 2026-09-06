/** A transport-owned client resolves the current generation for each new call.
 * In-flight handlers retain their provider's normal revocation and drain rules. */
import { directDispatch } from "@kolu/surface/links/direct"
import { restrictHandlers, type FaceExposure } from "@kolu/surface/expose"
import { brandDirectDispatch } from "@kolu/surface/link"
import { clientOn } from "./client.ts"
import { ToolFailure } from "@kolu/surface-mcp"
import { Effect, Stream } from "effect"
import { writerAt, type Bound } from "./authority.ts"

export const liveDispatch = (
  read: () => Bound & { readonly expose: FaceExposure },
  caller: Parameters<typeof writerAt>[1],
) => {
  const current = () => {
    const bound = read()
    const handlers = restrictHandlers(bound.group, writerAt(bound, caller), bound.expose)
    return { handlers, dispatch: directDispatch({ handlers }) }
  }
  const unavailable = (tag: string) => new ToolFailure("The capability for this operation is not active.", { unavailable: tag })
  return brandDirectDispatch({
    unary: (tag: string, payload: unknown) => Effect.suspend(() => {
      const value = current()
      return tag in value.handlers ? value.dispatch.unary(tag, payload) : Effect.fail(unavailable(tag))
    }),
    stream: (tag: string, payload: unknown) => Stream.unwrap(Effect.sync(() => {
      const value = current()
      return tag in value.handlers ? value.dispatch.stream(tag, payload) : Stream.fail(unavailable(tag))
    })),
  })
}

export const liveClient = (...args: Parameters<typeof liveDispatch>) => clientOn(liveDispatch(...args))
