import { location, serviceTag } from "@olai/plugin-api/contracts"
import { CONFIGURATION_FILE } from "@olai/plugin-api/configuration"
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
 * A heading NAMED AFTER A PLUGIN — the settings a plugin marked as preferences.
 *
 * A promoted leaf (`@olai/plugin-api/configuration`'s `preference`) is drawn
 * here, under its plugin's heading, and moves out of the plugins panel while
 * that plugin is running. The two fields are the plugin's own name (the
 * settings namespace its rows are grouped by) and the words a person reads.
 *
 * THE WORDS ARE THE BUILD'S, and they are a READER because they are live: the
 * label comes from `olai.yml`'s `label` — `@olai/surface`'s `PluginLook`, read
 * off the roster by whoever contributes the rows — so a contributor hands over
 * `() => look(plugin).label ?? plugin` rather than a snapshot of it. The panel
 * never spells a plugin's name, and a rebuilt roster's words reach the heading
 * without a re-registration.
 */
export interface PluginHeading {
  /** The plugin's `name` — the settings namespace. Contributions naming the
   *  same plugin are drawn together under one heading. */
  readonly plugin: string
  /** The words a person reads, read when the heading is drawn. */
  readonly label: () => string
}

/** Either a key of {@link HEADINGS} or a {@link PluginHeading}. */
export type HeadingName = Heading | PluginHeading

/**
 * WHERE A GROUP'S CHOICE IS KEPT, and what its scope line says. A fixed
 * heading's rows are this browser's; a promoted leaf's are the serve's —
 * written to `_olai/Settings.olai` for everybody using this directory.
 */
export type Scope = "browser" | "shared"

export const SCOPE_WORDS: Record<Scope, string> = {
  browser: "Saved in this browser only.",
  shared: `Saved in ${CONFIGURATION_FILE.split("/").pop()}, for everyone using this directory.`,
}

/**
 * One contribution to the preferences panel: rows, under a heading, at a place
 * within it. A heading whose contributors are all switched off is not drawn.
 */
export interface Section {
  /** The heading these rows sit under — a key of {@link HEADINGS}, or a
   *  plugin-named heading carrying the plugin's name and its label. */
  readonly heading: HeadingName
  /** Lower first, among the contributions under the same heading only. */
  readonly order: number
  /**
   * WHERE THESE ROWS' CHOICES ARE KEPT — a fact about the contribution, not
   * something the panel may infer from the shape of its heading: a plugin that
   * one day contributes browser-local rows under its own heading declares
   * `browser` here and is drawn (and labelled) with this browser's rows.
   *
   * Two contributions under ONE heading should agree; the panel draws a group
   * as `shared` if any of its entries says so, because the one arrangement the
   * ordering exists to prevent is a shared row under the browser-only line.
   */
  readonly scope: Scope
  readonly body: () => JSX.Element
}
export const sections = location<Section>("preferences.sections")

/**
 * OPEN THE PREFERENCES PANEL — the one verb the panel offers, so a link
 * elsewhere can land somebody here without importing the panel or its state.
 *
 * THIS PACKAGE offers it, for as long as its activation runs; a consumer holds
 * it as an optional dependency and draws its own control when the door is
 * absent. Mirrors the inspector's own `configuration.open(name)`, which is what
 * a consumer already knows how to hold.
 */
export interface PreferencesPanel {
  readonly open: () => void
}
export const preferencesPanel = serviceTag<PreferencesPanel>("preferences.open")
