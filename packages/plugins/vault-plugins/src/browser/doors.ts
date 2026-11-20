import { heldService } from "@olai/ui-primitives/held.ts"
import type { EnginesService } from "olai-plugin-chat/browser-engines"
import type { BesideDoor } from "olai-plugin-chat/beside"
import type { Navigation, PaletteControl } from "olai-plugin-navigation/contract"

const box = heldService<PaletteControl>()
export const holdPalette = box.hold
export const palette = box.read

const lane = heldService<Navigation>()
export const holdRouter = lane.hold
export const router = lane.read

const aside = heldService<BesideDoor>()
export const holdBeside = aside.hold
export const beside = aside.read

const agents = heldService<EnginesService>()
export const holdEngines = agents.hold
export const engines = agents.read
