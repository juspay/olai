/** Row-private lifecycle gate. Components can start before the row's apply
 * finishes. Open only after routes, clock and wire are acquired; close before
 * withdrawing them so no circuit can use a released row resource. */
import { heldService } from "@olai/ui-primitives/held.ts"
const held = heldService<true>()
export const holdReady = () => held.hold(true)
export const journalReady = held.read
