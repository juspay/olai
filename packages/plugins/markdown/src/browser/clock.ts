/** The content activation owns this hold on its declared renderer clock. */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Clocks } from "@olai/plugin-api"

const provider = heldService<Clocks>()
export const holdClocks = provider.hold
export const today = (): string => provider.read()?.today() ?? ""
