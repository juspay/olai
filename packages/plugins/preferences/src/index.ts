import { location } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "preferences"

/**
 * The panel's headings, in the order they are drawn. This package owns them: a
 * contributor names one by its key and never spells, orders or matches a
 * heading's words itself, so two plugins sharing a heading cannot disagree
 * about it, and a key that is not here is a type error.
 */
export const HEADINGS = [
  { key: "appearance", label: "Appearance" },
  { key: "outlines", label: "Outlines" },
  { key: "notifications", label: "Notifications" },
] as const
export type Heading = (typeof HEADINGS)[number]["key"]

/**
 * One contribution to the preferences panel: rows, under a heading, at a place
 * within it. A heading whose contributors are all switched off is not drawn.
 */
export interface Section {
  /** The heading these rows sit under — a key of {@link HEADINGS}. */
  readonly heading: Heading
  /** Lower first, among the contributions under the same heading only. */
  readonly order: number
  readonly body: () => JSX.Element
}
export const sections = location<Section>("preferences.sections")
