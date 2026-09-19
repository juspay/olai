import type { Conversing } from "../../sessions.ts"
import { chatWire } from "../wire.ts"

/** Owned by the caller's reactive scope. Unlike state.use, this member cannot
 * wake a conversation even when a stale roster survives a wire reconnect. */
export const keepConversation = (to: Conversing): void => {
  chatWire().streams.holding.use(() => to)
}
