/** Static extension contracts owned by the sidebar capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export interface SidebarEntry {
  readonly place: "top" | "bottom"
  readonly body: () => JSX.Element
  readonly rail?: () => JSX.Element
}

export interface SidebarSection {
  /** The heading, in the plugin's words. */
  readonly said: string
  /** ...and what sits under it. */
  readonly body: () => JSX.Element
}

declare module "@olai/plugin-api/slots" {
  interface SlotDefinitions {
    "sidebar.entry": SlotDefinition<SidebarEntry, "nothing">
    "sidebar.section": SlotDefinition<SidebarSection, "nothing">
  }
}

export const slotContracts = {
  "sidebar.entry": slotContract<SidebarEntry>("sidebar.entry","nothing"),
  "sidebar.section": slotContract<SidebarSection>("sidebar.section","nothing"),
} as const
