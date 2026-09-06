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
 readonly prefix?: {readonly value:string;readonly label:string;readonly empty:string;readonly run:(text:string)=>Promise<import("@olai/web/client/saying.ts").Said>;readonly after:string}
}
export const paletteAdapters = location<PaletteAdapter>("navigation.paletteAdapters")

export type {PaletteItem} from "./palette/items.ts"
export const fileLinks=serviceTag<import("./opens.tsx").Opens>("navigation.file-links")
