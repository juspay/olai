/** Static extension contracts owned by the chat capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"
import type { NotHere } from "@olai/plugin-api"



declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "delivery.mark": SlotDefinition<() => JSX.Element, "plugin">
    "engine.install": SlotDefinition<NotHere, "plugin">
  }
}

export const slotContracts = {
  "delivery.mark": slotContract<() => JSX.Element>("delivery.mark","plugin"),
  "engine.install": slotContract<NotHere>("engine.install","plugin"),
} as const
