/** Per-call attribution supplied by the transport, never by an RPC payload.
 * Providers interpret their own door type. The host only carries the value
 * through the call's Effect context; it does not replace provider handlers. */
import type { SurfaceHandlers } from "@kolu/surface/server"
import { Context, Effect, Stream } from "effect"
export const RequestAuthority = Context.Reference<{ readonly writer: string, readonly door?: unknown }>("olai/RequestAuthority", {
  defaultValue: () => ({ writer: "web" }),
})

/** Bind only declared writes; read handlers retain their identity and scopes. */
export const authorityAt = (
  bound: { readonly handlers: SurfaceHandlers; readonly writes: ReadonlyArray<string> },
  caller: { readonly writer: string; readonly door?: unknown },
): SurfaceHandlers => {
  const handlers: SurfaceHandlers = {}
  for (const [tag, handle] of Object.entries(bound.handlers)) {
    handlers[tag] = !bound.writes.includes(tag) ? handle : input => {
      const result = handle(input)
      return Effect.isEffect(result)
        ? Effect.provideService(result, RequestAuthority, caller)
        : Stream.provideService(result, RequestAuthority, caller)
    }
  }
  return handlers
}
