import { location, serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor, JSX } from "solid-js"
import type { Route } from "./routes.ts"
import type { Router, NavigationRouter } from "./routing.tsx"
export const name = "navigation"
export const PAGE_SUBJECT = "data-page-subject"
export interface PageInfo {
  readonly pending?: boolean
  readonly failure?: string
  readonly file?: string
  readonly title?: string
  readonly history?: Pick<import("@olai/edit-history/undoing.ts").Undo, "undo" | "redo" | "record">
}
export interface Navigation extends NavigationRouter {
  readonly page: (index: number | Accessor<number>) => JSX.Element
  readonly info: (index: number) => PageInfo | undefined
  readonly focused: Accessor<PageInfo | undefined>
  readonly report: (index: Accessor<number>, info: Accessor<PageInfo>) => void
  readonly routes: import("./workspace.ts").WorkspaceRouting
}
export const navigation = serviceTag<Navigation>("navigation.state")
export interface ContentHandler {
  readonly matches: (route: Route) => boolean
  readonly Page: (props: { readonly route: Route; readonly index: number }) => JSX.Element
}
export const content = location<ContentHandler>("navigation.content")
export type { Route, Router }

export interface PaletteAdapter {
 readonly available?: () => boolean
 readonly items?: () => ReadonlyArray<import("./palette/items.ts").PaletteItem>
 readonly accepts?: (request: unknown) => boolean
 readonly write?: (request: unknown) => Promise<import("@olai/web/client/saying.ts").Said | undefined>
 readonly key?: (action: string) => void
 readonly prefix?: import("./palette/items.ts").PalettePrefix
}
export const paletteAdapters = location<PaletteAdapter>("navigation.palette-adapters")

export interface PaletteControl {
  readonly open: Accessor<boolean>
  readonly asking: Accessor<import("./palette/asking.ts").Asking | null>
  readonly show: () => void
  readonly showAt: (path: ReadonlyArray<string>, text?: string) => void
  readonly ask: (asking: import("./palette/asking.ts").Asking) => void
  readonly dropQuestion: () => void
  readonly close: () => void
}
export const paletteControl = serviceTag<PaletteControl>("navigation.palette")

export type {PaletteItem, PalettePrefix} from "./palette/items.ts"
export type {
  LevelRows, LevelScope, PaletteGroup, PaletteLevel, PaletteOption, PaletteRunResult, PaletteValue,
} from "./palette/levels.ts"

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

export interface LinkPreview {
  readonly priority: number
  readonly matches: (route: Route) => boolean
  readonly Preview: (props: { readonly route: Route }) => JSX.Element
}
export const linkPreviews = location<LinkPreview>("navigation.link-previews", "many")
