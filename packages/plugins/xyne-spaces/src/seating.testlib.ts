/** Stand-in for the seating provider; production knows only the service. */
import { agentsIn, declarationsOf, type Derived } from "@olai/format"

export const SESSION_TYPE = "chat-agent-session"
const kinds = new Map([[SESSION_TYPE, {
  kind: SESSION_TYPE, takes: "a test seat", admits: () => true, claims: SESSION_TYPE,
}]])
export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, { built: kinds, enabled: kinds }), SESSION_TYPE)
