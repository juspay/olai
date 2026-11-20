export const name = "pins"

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Shelf } from "@olai/format"

export const pinnedShelf = serviceTag<{ readonly shelf: () => Shelf }>("pins.state")
