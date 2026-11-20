import { heldService } from "@olai/ui-primitives/held.ts"
const held = heldService<true>()
export const holdReady = () => held.hold(true)
export const journalReady = held.read
