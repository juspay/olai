import { serviceTag, location } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Client } from "./client.ts"
import type { References } from "./contracts/references.ts"
import type { Air } from "./browser/drag/air.ts"
import type { Fields } from "./browser/drag/fields.ts"
import type { Readings } from "./browser/reading.tsx"
export interface OutlinesBrowser {
  readonly client: () => Client
  readonly undo: Undo
  readonly readings: Readings
  readonly fields: Fields
  readonly air: Air
  readonly references: References
  readonly overlay: () => HTMLDivElement
}
export const browserState = serviceTag<OutlinesBrowser>("outlines.browser-state")

import type { DayEntry } from "@olai/format"
import type { JSX } from "solid-js"
export interface DatedRowProps { readonly dated: DayEntry; readonly trail: "over" | "under"; readonly pill?: string }
export const datedRows = location<(props: DatedRowProps) => JSX.Element>("outlines.dated-row", "one")
import type { Shown } from "@olai/format"
import type { Drawn } from "./contracts/page.ts"
export interface PageBodyProps { readonly page: Shown; readonly drawn: Drawn; readonly held: Drawn; readonly today: string }
export const pageView = location<(props: {readonly render: (props: PageBodyProps) => JSX.Element}) => JSX.Element>("outlines.page-view", "one")
export interface TitleProps { readonly title: string; readonly from: string; readonly needles?: ReadonlyArray<string>; readonly links?: boolean }
export const titles = location<(props: TitleProps) => JSX.Element>("outlines.title", "one")
import type { Meaning } from "@olai/format"
import type { Route } from "olai-plugin-navigation/contract"
export const propertyRoutes = location<(meaning: Meaning) => Route | undefined>("outlines.property-route")
