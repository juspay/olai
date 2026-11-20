import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export interface PluginsRowFace {
  readonly needs: () => boolean
  readonly body: () => JSX.Element
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "plugins.row": SlotDefinition<PluginsRowFace, "plugin">
  }
}

export const slotContracts = {
  "plugins.row": slotContract<PluginsRowFace>("plugins.row", "plugin"),
} as const

export const pluginsRow = slotContracts["plugins.row"]
