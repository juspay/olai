/** The durable seating reading, shared by the roster and chat.seating. */
import { agentsIn, declarationsOf, type Derived } from "@olai/format"
import { ownKinds, SESSION_TYPE } from "./kinds.ts"

export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, ownKinds), SESSION_TYPE)
