import { agentsIn, declarationsOf, type Derived, type NodeAgents, notesIn, type Reading } from "@olai/format"
import { OPENS_TYPE, ownKinds, SESSION_TYPE } from "./kinds.ts"

export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, ownKinds), SESSION_TYPE)

export const rosterIn = (
  reading: Pick<Reading, "set" | "claims" | "derived">,
): NodeAgents => {
  const declarations = declarationsOf(reading.derived, ownKinds)
  return [
    ...agentsIn(reading.derived, declarations, SESSION_TYPE),
    ...notesIn(reading.set, reading.claims, declarations, SESSION_TYPE, OPENS_TYPE),
  ]
}
