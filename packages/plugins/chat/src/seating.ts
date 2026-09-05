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
import { agentsIn, declarationsOf, type Derived } from "@olai/format"
import { ownKinds, SESSION_TYPE } from "./kinds.ts"

export const seatingIn = (derived: Derived) =>
  agentsIn(derived, declarationsOf(derived, ownKinds), SESSION_TYPE)
