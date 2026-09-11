/** Temporary dock navigation, owned by this plugin activation. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Conversing } from "../wire.ts"
const selection = heldService<(to: Conversing) => void>()
export const holdSelection = selection.hold
export const selectConversation = (to: Conversing) => selection.read()?.(to)
