import { heldService } from "@olai/ui-primitives/held.ts"
import type { Gestures } from "olai-plugin-navigation/contract"

const provider = heldService<Gestures>()

export const holdGestures = provider.hold

export const swallowGhost = (): void => provider.read()?.swallowGhost()
