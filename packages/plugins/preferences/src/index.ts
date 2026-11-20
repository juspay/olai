import { location, serviceTag } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "preferences"

export const HEADINGS = [
  { key: "appearance", label: "Appearance" },
  { key: "outlines", label: "Outlines" },
  { key: "notifications", label: "Notifications" },
] as const
export type Heading = (typeof HEADINGS)[number]["key"]

export interface PluginHeading {
  readonly plugin: string
  readonly label: () => string
}

export type HeadingName = Heading | PluginHeading

export type Scope = "browser" | "shared"

export interface Section {
  readonly heading: HeadingName
  readonly order: number
  readonly scope: Scope
  readonly body: () => JSX.Element
}
export const sections = location<Section>("preferences.sections")

export interface PreferencesPanel {
  readonly open: () => void
}
export const preferencesPanel = serviceTag<PreferencesPanel>("preferences.open")
