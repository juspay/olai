import { location } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "preferences"

/**
 * One contribution to the preferences panel: rows, under a heading, at a place.
 *
 * The panel draws headings and knows none of them. Each contributor says which
 * heading its rows belong under, in the words a person reads (`Appearance`,
 * `Notifications`), and where they sit; contributions naming the same heading
 * are drawn together under it, at the place of the first. So a plugin that
 * joins an existing heading needs nothing from the plugin already there, and
 * a heading whose contributors are all switched off is simply not drawn.
 */
export interface Section {
  /** The heading these rows sit under. Rows naming the same heading share it. */
  readonly group: string
  /** Lower first, across the whole panel. A heading sits at its first row's
   *  place; within a heading, contributions follow this too. */
  readonly order: number
  readonly body: () => JSX.Element
}
export const sections = location<Section>("preferences.sections")
