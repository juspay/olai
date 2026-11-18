/**
 * CHAT'S DURABLE SEATING, offered as a reading rather than an exported word.
 *
 * A mirror needs to know which node owns a conversation. Exporting the kind
 * word made the consumer reconstruct that answer: it imported chat's constant,
 * built a second vocabulary, and interpreted the vault itself. That coupled
 * the mirror to how chat stores a seat without making the import follow the
 * provider's lifetime. A module stays imported after its plugin is switched off.
 *
 * `server.ts` offers this reading through `Offers.own("seating", ...)`, which
 * stamps `chat.seating` from the providing fiber. Consumers declare the key in
 * `needs`; they wait before chat starts and unload when its provision leaves.
 * The service conveys the answer and gives that dependency a lifetime.
 *
 * The roster and the offered door call THIS function. The format owns the
 * grammar, chat owns which kind means seating, and the vault's declarations
 * override chat's default claim. Keeping that fold here means a change to the
 * binding vocabulary cannot make the sidebar and a mirror disagree about one
 * snapshot. The caller supplies that snapshot; there is no second live store
 * behind this door, and no conversation process is needed to read a seat.
 */
import { agentsIn, declarationsOf, type Derived, type NodeAgents, notesIn, type Reading } from "@olai/format"
import { OPENS_TYPE, ownKinds, SESSION_TYPE } from "./kinds.ts"

export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, ownKinds), SESSION_TYPE)

/**
 * ...AND THE WHOLE ROSTER, which is the NODES above and then the NOTES — the
 * reading this plugin's own server builds its carrier from.
 *
 * TWO READINGS AND ONE ORDER. A node keeps its tie as a property on its row and
 * its memory in the rows under it; a note keeps its tie in the YAML block at the
 * top of the file and IS its own memory. Nothing else can have one. They are
 * joined here, nodes first and then notes in corpus order, because the join is
 * the roster — every lookup below it is by ITEM KEY (`@olai/format`'s
 * `itemKey`: a node's id, or `/` and a note's path), and a second assembly
 * somewhere else would be a second answer to what the roster is.
 *
 * IT TAKES A READING AND NOT A DERIVATION, which is the one thing that keeps it
 * out of the door above: the notes are read off the SET (the documents the
 * directory holds and their front matter), and a derivation carries records. So
 * the offered `chat.seating` stays the node reading — that is the question a
 * mirror asks, and the only one it can answer from what it holds.
 */
export const rosterIn = (
  reading: Pick<Reading, "set" | "claims" | "derived">,
): NodeAgents => {
  const declarations = declarationsOf(reading.derived, ownKinds)
  return [
    ...agentsIn(reading.derived, declarations, SESSION_TYPE),
    ...notesIn(reading.set, reading.claims, declarations, SESSION_TYPE, OPENS_TYPE),
  ]
}
