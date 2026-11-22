/** Per-call attribution supplied by the transport, never by an RPC payload.
 * Providers interpret their own session rule. The host only carries the value
 * through the call's Effect context; it does not replace provider handlers. */
import type { SurfaceHandlers } from "@kolu/surface/server"
import type { Caller } from "@olai/ops"
import { Context, Effect, Stream } from "effect"

/** WHO MADE THIS CALL: the transport's caller — a `Writer` and the session's
 *  rule, `@olai/ops`' `Caller` — handed to a member a registration lists in
 *  `writes`. Any other member is handed the default, `{ writer: "web" }` with
 *  no rule, whoever called it. */
export const RequestAuthority = Context.Reference<Caller>("olai/RequestAuthority", {
  defaultValue: () => ({ writer: "web" }),
})

/** Bind only declared writes; read handlers retain their identity and scopes. */
export const authorityAt = (
  bound: { readonly handlers: SurfaceHandlers; readonly writes: ReadonlyArray<string> },
  caller: Caller,
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
