import { heldService } from "@olai/ui-primitives/held.ts"
import type { Navigation } from "olai-plugin-navigation/contract"
const held = heldService<Navigation>()
export const holdNavigation = held.hold
export const navigation = held.read
