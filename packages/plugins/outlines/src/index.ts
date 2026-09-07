import { serviceTag, location } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Client } from "./client.ts"
import type { References } from "./contracts/references.ts"
import type { Air } from "./browser/drag/air.ts"
import type { Fields } from "./browser/drag/fields.ts"
import type { Readings } from "./browser/reading.tsx"

/**
 * WHAT THIS ROW OWNS IN A TAB — the state a consumer that names
 * {@link browserState} is handed.
 *
 * IT USED TO BE `Record<string, never>`, and the emptiness was the defect: the
 * row announced "my browser state is ready" on a service carrying nothing,
 * while the undo stack, the page readings and the two drag registers went into
 * module variables beside it. Cordis saw the announcement and none of the
 * consumers (the audit's §2).
 *
 * THE TYPES ARE `import type`, and every one of them is this package's own —
 * so this door names the shapes without pulling a line of the row's
 * implementation onto anybody's graph. `@olai/bundle`'s fence walks what a
 * contract door actually EVALUATES (`scanImports` elides a type-only import),
 * which is the difference between naming a shape and reaching for a value.
 */
export interface OutlinesBrowser {
  /** This row's sibling client, on whichever wire is current. */
  readonly client: () => Client
  /** The editor history a keystroke and a `•••` verb share. */
  readonly undo: Undo
  /** The standing page readings this tab has open. */
  readonly readings: Readings
  /** The two drag registers — what is under the pointer, and where a drop
   *  would land. */
  readonly fields: Fields
  readonly air: Air
  /** ...and this row's naming of a node, which is also offered on its own key
   *  for the one consumer in another package (`./contracts/references.ts`). */
  readonly references: References
  /** The document-level socket this row's overlays hang from, minted and
   *  removed with the activation (`./browser/overlay.ts`). */
  readonly overlay: () => HTMLDivElement
}
export const browserState = serviceTag<OutlinesBrowser>("outlines.browser-state")

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
