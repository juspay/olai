import { heldService } from "@olai/ui-primitives/held.ts"
import type { Asking } from "olai-plugin-navigation/palette-asking"
import type { PaletteControl } from "olai-plugin-navigation/contract"

const provider = heldService<PaletteControl>()

export const holdPalette = provider.hold

export const askInPalette = (asking: Asking): void => provider.read()?.ask(asking)

export const paletteAsking = (): Asking | null => provider.read()?.asking() ?? null
