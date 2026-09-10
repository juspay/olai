/**
 * THE PINNED SHELF, as an outline row reads it — held for the activation that
 * declared it.
 *
 * One glyph on a row asks whether this node's page is already a door in the
 * sidebar, and the `•••` asks the same to decide which of the two labels its
 * shelf verb wears. The answer is `olai-plugin-pins`', and it arrives on
 * `pins.state` — declared on `../browser.tsx`'s `pins` component. It used to
 * arrive as `usePins`: a module signal in that row's own door, read across the
 * wall with nothing declared (the audit's §12).
 *
 * A COMPONENT AND NOT THIS ROW: an outline with no pins row mounted is a whole
 * outline, and the glyph is simply not drawn — which is what the empty shelf
 * below answers, and what every reader here already drew for a directory with
 * no `Pins.olai` in it.
 */
import { NO_PINS, type Shelf } from "@olai/format"
import { heldService } from "@olai/ui-primitives/held.ts"

const provider = heldService<{ readonly shelf: () => Shelf }>()

/** Told by `../browser.tsx`'s `pins` component, for that activation. */
export const holdPins = provider.hold

/** The shelf as the server last answered it. */
export const usePins = (): (() => Shelf) => () => provider.read()?.shelf() ?? NO_PINS
