import { serviceTag, location } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"
export const browserState = serviceTag<Record<string, never>>("outlines.browser-state")

import type { DayEntry } from "@olai/format"
import type { JSX } from "solid-js"
export interface DatedRowProps { readonly dated: DayEntry; readonly trail: "over" | "under"; readonly pill?: string }
export const datedRows = location<(props: DatedRowProps) => JSX.Element>("outlines.dated-row", "one")
export const documentReferences = location<(props: {readonly file: string; readonly inline?: boolean}) => JSX.Element>("outlines.document-reference", "one")
import type { Shown } from "@olai/format"
import type { Drawn } from "./contracts/page.ts"
export interface PageBodyProps { readonly page: Shown; readonly drawn: Drawn; readonly held: Drawn; readonly today: string }
export const pageView = location<(props: {readonly render: (props: PageBodyProps) => JSX.Element}) => JSX.Element>("outlines.page-view", "one")
export interface TitleProps { readonly title: string; readonly from: string; readonly needles?: ReadonlyArray<string>; readonly links?: boolean }
export const titles = location<(props: TitleProps) => JSX.Element>("outlines.title", "one")
import type { Meaning } from "@olai/format"
import type { Route } from "olai-plugin-navigation/contract"
/** Capabilities contribute only the meanings whose destinations they own. */
export const propertyRoutes = location<(meaning: Meaning) => Route | undefined>("outlines.property-route")
