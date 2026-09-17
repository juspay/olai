import { heldService } from "@olai/ui-primitives/held.ts"
import type { OutlinesBrowser } from "olai-plugin-outlines/contract"

/** Page metadata stays on outlines' existing per-pane reading. */
const held = heldService<OutlinesBrowser["readings"]>()
export const holdPages = held.hold
export const pageReadings = held.read
