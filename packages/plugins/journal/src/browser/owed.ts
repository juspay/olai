import { heldService } from "@olai/ui-primitives/held.ts"
import type { OwedReading } from "@olai/format"
import type { Accessor } from "solid-js"
const held = heldService<Accessor<OwedReading | undefined>>()
export const holdOwed = held.hold
export const owedToday: Accessor<OwedReading | undefined> = () => held.read()?.()
