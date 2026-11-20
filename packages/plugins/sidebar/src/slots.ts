import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

export type SidebarPlace = "top" | "bottom" | "foot"

export interface SidebarEntry {
  readonly place: SidebarPlace
  readonly body: () => JSX.Element
  readonly rail?: () => JSX.Element
}

export interface SidebarSection {
  readonly said: string
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
