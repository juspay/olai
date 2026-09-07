export const name = "pins"

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Shelf } from "@olai/format"

/**
 * THE SHELF THE SERVER ANSWERED — the rows of `Pins.olai` with every node
 * address resolved, re-sent whenever a published revision changes what it says
 * (`@olai/format`'s `shelfOf`).
 *
 * IT CARRIED NOTHING, and the emptiness was the defect: this key was
 * `serviceTag<{}>` — a row announcing "my browser state is ready" — while the
 * value it is named after went into a module signal in `./browser/answered.tsx`
 * that `olai-plugin-outlines` read across the wall to draw a pin glyph on a
 * row. Cordis saw the announcement and none of the consumers, which is the
 * audit's §2.
 *
 * AN ACCESSOR rather than the rows: the answer is a fresh array each time the
 * shelf changes, and a service handing over the rows themselves would hand out
 * the ones that were current when its consumer activated.
 */
export const pinsState = serviceTag<{ readonly shelf: () => Shelf }>("pins.state")
