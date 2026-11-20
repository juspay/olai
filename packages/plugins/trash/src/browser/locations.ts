import { heldService } from "@olai/ui-primitives/held.ts"
import type { Locations } from "@olai/plugin-api/contracts"

const reader = heldService<Locations["read"]>()

export const holdLocations = reader.hold

export const readLocation: Locations["read"] = (slot) => reader.read()?.(slot) ?? []
