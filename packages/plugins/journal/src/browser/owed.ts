/** One owed stream belongs to the journal activation. Sidebar faces and the
 * reminder integration read it; collapsing a face does not end the work. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Owed } from "@olai/format"
import type { Accessor } from "solid-js"
const held = heldService<Accessor<Owed | undefined>>()
export const holdOwed = held.hold
export const owedToday: Accessor<Owed | undefined> = () => held.read()?.()
