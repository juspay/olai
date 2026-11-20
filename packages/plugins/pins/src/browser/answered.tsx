import { heldService } from "@olai/ui-primitives/held.ts"

import { NO_PINS, type Shelf } from "@olai/format"

const shelf = heldService<() => Shelf>()

export const usePins = (): (() => Shelf) => () => shelf.read()?.() ?? NO_PINS

export const holdPins = shelf.hold
