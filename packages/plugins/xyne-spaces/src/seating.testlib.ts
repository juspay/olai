/**
 * TEST-ONLY STAND-IN for the declared seating service. Production never sees
 * this permissive vocabulary or its `takes` sentence: chat's offered door is
 * the real provider. These fixtures let the mirror tests supply seating while
 * exercising their own channel and delivery rules without importing chat.
 */
import { agentsIn, declarationsOf, type Derived } from "@olai/format"

export const SESSION_TYPE = "chat-agent-session"
const kinds = new Map([[SESSION_TYPE, {
  kind: SESSION_TYPE, takes: "a test seat", admits: () => true, claims: SESSION_TYPE,
}]])
export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, { built: kinds, enabled: kinds }), SESSION_TYPE)
