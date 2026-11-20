import { heldService } from "@olai/ui-primitives/held.ts"
import type { PaletteControl } from "olai-plugin-navigation/contract"

const provider = heldService<PaletteControl>()

export const holdPalette = provider.hold

export const openPalette = (): void => provider.read()?.show()
