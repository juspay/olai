/** Per-call attribution supplied by the transport, never by an RPC payload.
 * Providers interpret their own fence type. The host only carries the value
 * through the call's Effect context; it does not replace provider handlers. */
import { Context } from "effect"
export const RequestAuthority = Context.Reference<{ readonly writer: string, readonly fence?: unknown }>("olai/RequestAuthority", {
  defaultValue: () => ({ writer: "web" }),
})
