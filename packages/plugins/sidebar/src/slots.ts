/** Static extension contracts owned by the sidebar capability. */
import type { JSX } from "solid-js"
import { slotContract, type SlotDefinition } from "@olai/plugin-api/slots"

/**
 * WHERE AN ENTRY STANDS in the column, as a word the sidebar spends — a
 * contributor names a placement, never a pixel and never another plugin:
 *
 *   - `top`: the column's first doors (Agenda, Today), above every region;
 *   - `bottom`: after the plugin sections, above the pinned shelf;
 *   - `foot`: pinned under the scrolling list, where it stays in view however
 *     long the list runs (Trash). On the rail, the same entry's icon sinks to
 *     the rail's foot.
 */
export type SidebarPlace = "top" | "bottom" | "foot"

export interface SidebarEntry {
  readonly place: SidebarPlace
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
