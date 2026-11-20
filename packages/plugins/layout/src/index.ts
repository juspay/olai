import { location } from "@olai/plugin-api/contracts"
import type { BrokenFile } from "@olai/format"
import type { InboxHeld } from "@olai/format"
import type { JSX } from "solid-js"

export const name = "layout"
export interface SidebarProps {
  readonly Resize:()=>JSX.Element
  readonly foot?: JSX.Element
  readonly open: boolean
  readonly onClose: () => void
}
export interface SidebarSeat {
  readonly Sidebar: (props: SidebarProps) => JSX.Element
  readonly Rail: (props: { readonly home: () => void }) => JSX.Element
}
export const sidebar = location<SidebarSeat>("layout.sidebar", "one")

export type ToolWhere = "header" | "health" | "closet"

export interface LayoutTool {
  readonly body: (props: { readonly where: ToolWhere }) => JSX.Element
  readonly headerOrder: number
  readonly closetOrder: number
  readonly mobileWithoutSidebar?: boolean
  readonly desktop?: Exclude<ToolWhere, "closet">
}
export const tools = location<LayoutTool>("layout.tools")

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
import type { SetOptions } from "@olai/web/client/preference.ts"
export const deployment = serviceTag<{
  readonly called: Accessor<string | undefined>
  readonly started: Accessor<string | undefined>
}>("layout.deployment")

export const contentStatus = location<{readonly ready:()=>boolean;readonly Message:()=>JSX.Element}>("layout.content-status")

export const overlays = location<(props:{readonly toggleDirectory:()=>void})=>JSX.Element>("layout.overlays")

export const strip = location<() => JSX.Element>("layout.strip", "one")

export interface Thumb {
  readonly order: number
  readonly body: () => JSX.Element
}
export const thumbs = location<Thumb>("layout.thumbs")

export interface Shell {
  readonly desktop: Accessor<boolean>
  readonly sidebarOpen: Accessor<boolean>
  readonly setSidebarOpen: (open: boolean) => void
  readonly toggleSidebar: () => void
  readonly revealSidebar: () => void
  readonly sidebarWidth: Accessor<number>
  readonly setSidebarWidth: (px: number, opts?: SetOptions) => void
  readonly resetSidebarWidth: () => void
}
export const shell = serviceTag<Shell>("layout.shell")

export { slotContracts as slots } from "./slots.ts"
