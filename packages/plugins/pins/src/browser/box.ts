/**
 * ASKING FOR A NAME IN THE PALETTE, as pins reaches it — held for the
 * activation that declared it.
 *
 * Renaming a pin asks its question in the ⌘K box rather than in a dialog of
 * this row's own. That verb is `olai-plugin-navigation`'s and arrives on
 * `navigation.palette`, declared on `./Palette.tsx`'s `palette` component; it
 * used to be a module variable in navigation's `palette/open.ts`, read across
 * the wall with nothing declared (the audit's §12).
 *
 * A SERVE WITH NO NAVIGATION ROW has no box to ask in, so the ask does nothing
 * and the reading answers `null` — which is what this row's palette adapter
 * already drew for a question nobody had asked. (`./palette.ts` beside this is
 * a different thing: the ROW this row contributes to the palette's list.)
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Asking } from "olai-plugin-navigation/palette-asking"
import type { PaletteControl } from "olai-plugin-navigation/contract"

const provider = heldService<PaletteControl>()

/** Told by `./Palette.tsx`'s `palette` component, for that activation. */
export const holdPalette = provider.hold

/** Ask this question in the box. */
export const askInPalette = (asking: Asking): void => provider.read()?.ask(asking)

/** ...and what it is asking now, or `null`. */
export const paletteAsking = (): Asking | null => provider.read()?.asking() ?? null
