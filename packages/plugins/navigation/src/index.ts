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
  /**
   * THE FOUR ROUTE OPERATIONS THAT READ THE MOUNTED ROSTER — printing a URL,
   * parsing one, finding the mounted tenant behind one, and telling two pages
   * apart.
   *
   * This row is the broker of that table: it is a projection of `Faces`, the
   * `renderer` component is where the dependency on the renderer is declared,
   * and `./pages.ts` is where its answer is held. A consumer that prints or
   * parses a PLUGIN route names this service and spends these; a consumer
   * whose routes are this app's own uses `hrefOfPlain` and needs no roster at
   * all.
   *
   * It was a module variable in `./routes.ts` with the four operations reading
   * it in place, so every caller in every package parsed and printed against
   * another activation's live table with nothing declared — the audit's §2 and
   * §12 in the one module the whole tree spells an address with.
   */
  readonly routes: import("./routes.ts").Routing
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

/**
 * THE PAGE'S GESTURE ARBITER — one verb, and the only one another row wants.
 *
 * A finger held on a row opens a menu, and the lift leaves a synthetic click
 * behind that would land on whatever the menu put under it. This row owns the
 * arbiter that eats it (`@olai/web`'s `client/ghost.ts`, started and stopped by
 * this row's activation); `olai-plugin-outlines` is the one that asks for a
 * ghost to be eaten, and it used to ask through a module variable on that
 * general door with nothing declared (the Cordis audit's §12).
 */
export interface Gestures {
  readonly swallowGhost: () => void
}
export const gestures = serviceTag<Gestures>("navigation.gestures")

export { slotContracts as slots } from "./slots.ts"


import type { Address } from "@olai/format"
import type { FileKindKey } from "@olai/plugin-api/file-kinds"
export interface FilePage {
  readonly by: FileKindKey
  readonly page: (address: Address) => JSX.Element
  readonly edits: boolean
}
export const pages = location<FilePage>("navigation.pages", "many", "key")
