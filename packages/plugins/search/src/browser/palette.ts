/**
 * OPENING THE PALETTE, as the header box reaches it — held for the activation
 * that declared it.
 *
 * The box's own control opens the ⌘K palette rather than drawing a second one.
 * That verb is `olai-plugin-navigation`'s and arrives on `navigation.palette`,
 * declared on `../browser.tsx`'s `palette` component; it used to be a module
 * variable in navigation's `palette/open.ts`, read across the wall with nothing
 * declared (the audit's §12).
 *
 * A SERVE WITH NO NAVIGATION ROW has no palette to open and the press does
 * nothing — which is what the empty read below answers, and what the box
 * already did before this row's own `apply` had run.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PaletteControl } from "olai-plugin-navigation/contract"

const provider = heldService<PaletteControl>()

/** Told by `../browser.tsx`'s `palette` component, for that activation. */
export const holdPalette = provider.hold

/** Open the palette on its ordinary list. */
export const openPalette = (): void => provider.read()?.show()
