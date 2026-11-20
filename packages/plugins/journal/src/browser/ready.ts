/** Open only after routes, clock and wire are acquired; close before
 * withdrawing them so no circuit can use a released row resource. */
import { heldService } from "@olai/ui-primitives/held.ts"
const held = heldService<true>()
export const holdReady = () => held.hold(true)
export const journalReady = held.read
