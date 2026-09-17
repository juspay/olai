import { heldService } from "@olai/ui-primitives/held.ts"
import type { Navigation, PaletteControl } from "olai-plugin-navigation/contract"
const held = heldService<Navigation>()
export const holdNavigation = held.hold
export const navigation = held.read

const control = heldService<PaletteControl>()
export const holdPalette = control.hold
export const palette = control.read
