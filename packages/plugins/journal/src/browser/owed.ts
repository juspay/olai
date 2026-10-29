/** One owed stream belongs to the journal activation. Sidebar faces and the
 * reminder integration read it; collapsing a face does not end the work.
 *
 * THE ROWS RIDE THE SAME READING as the two counts — the chip over the list and
 * the list under it are fields of one server message, so they cannot disagree
 * for a frame (`@olai/format`'s `OwedReading`). Folding the list away, or being
 * on `/agenda` where the column does not draw it, changes what is DRAWN and
 * never what is held. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { OwedReading } from "@olai/format"
import type { Accessor } from "solid-js"
const held = heldService<Accessor<OwedReading | undefined>>()
export const holdOwed = held.hold
export const owedToday: Accessor<OwedReading | undefined> = () => held.read()?.()
