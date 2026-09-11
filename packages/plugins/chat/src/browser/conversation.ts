import { heldService } from "@olai/ui-primitives/held.ts"
import type { Accessor } from "solid-js"
import type { ChatState } from "../wire.ts"
const held = heldService<Accessor<ChatState>>()
export const holdConversation = held.hold
/** Components can start before the row has acquired its reading. Absence
 * mounts no circuit; withdrawal disposes it before another reading is held. */
export const conversation = held.read
