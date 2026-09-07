/** Static navigation contracts. Providers own browser history; route content
 * registers independently of any particular layout. */
import { location, serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor, JSX } from "solid-js"
import type { Route } from "./routes.ts"
import type { Router } from "./routing.tsx"
export const name = "navigation"
export interface PageInfo { readonly file?: string; readonly title?: string; readonly history?: Pick<import("@olai/edit-history/undoing.ts").Undo,"undo"|"redo"|"record"> }
export interface Navigation extends Router {
  readonly page: (index: number | Accessor<number>) => JSX.Element
  readonly focused: Accessor<PageInfo | undefined>
  readonly report: (index: Accessor<number>, info: Accessor<PageInfo>) => void
}
export const navigation = serviceTag<Navigation>("navigation.state")
export interface ContentHandler {
  readonly matches: (route: Route) => boolean
  readonly Page: (props: { readonly route: Route; readonly index: number }) => JSX.Element
}
export const content = location<ContentHandler>("navigation.content")
export type { Route, Router }

/** Palette integrations own contextual commands and their writes. The palette
 * dispatches opaque requests through the entry that claims them. */
export interface PaletteAdapter {
 readonly items?: () => ReadonlyArray<import("./palette/items.ts").PaletteItem>
 readonly accepts?: (request: unknown) => boolean
 readonly write?: (request: unknown) => Promise<import("@olai/web/client/saying.ts").Said | undefined>
 readonly key?: (action: string) => void
 readonly prefix?: import("./palette/items.ts").PalettePrefix
}
export const paletteAdapters = location<PaletteAdapter>("navigation.palette-adapters")

/**
 * OPENING THE PALETTE, AND ASKING A QUESTION IN IT — what a row that is not
 * this one may do to the box.
 *
 * Two rows do: `olai-plugin-search`'s header box opens it, and
 * `olai-plugin-pins` asks for a name in it. Both used to reach a module
 * variable in this row's `palette/open.ts`, a declared door carrying live
 * state, so neither declared a dependency and neither stopped asking when this
 * row left (the audit's §12).
 *
 * WHAT IS ON IT is the four verbs and the two readings those two rows spend,
 * and no more: there is no `set`, so a sibling cannot put the box into a state
 * this row has no words for. The box itself, its input, its shortlist and every
 * decision about what a query means stay here.
 */
export interface PaletteControl {
  /** Whether the box is open at all. */
  readonly open: Accessor<boolean>
  /** ...and what it is asking, or `null` while it is merely listing. */
  readonly asking: Accessor<import("./palette/asking.ts").Asking | null>
  /** Open it on the ordinary list. */
  readonly show: () => void
  /** ...or open it on a question. */
  readonly ask: (asking: import("./palette/asking.ts").Asking) => void
  /** Put a question down without shutting the box. */
  readonly dropQuestion: () => void
  readonly close: () => void
}
export const paletteControl = serviceTag<PaletteControl>("navigation.palette")

export type {PaletteItem, PalettePrefix} from "./palette/items.ts"
export const fileLinks=serviceTag<import("./opens.tsx").Opens>("navigation.file-links")

export { slotContracts as slots } from "./slots.ts"
