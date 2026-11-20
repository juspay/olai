import { NO_PINS, type Shelf } from "@olai/format"
import { heldService } from "@olai/ui-primitives/held.ts"

const provider = heldService<{ readonly shelf: () => Shelf }>()

export const holdPins = provider.hold

export const usePins = (): (() => Shelf) => () => provider.read()?.shelf() ?? NO_PINS
