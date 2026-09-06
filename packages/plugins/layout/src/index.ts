import { location } from "@olai/plugin-api/contracts"
import type { BrokenFile } from "@olai/format"
import type { InboxHeld } from "@olai/format"
import type { JSX } from "solid-js"

export const name = "layout"
/** Transitional notebook inputs, removed as content readings become services.
 * The contract imports no sidebar implementation. */
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

/** Application tools can be drawn in the header or mobile directory footer.
 * Placement is shell policy; each entry owns its own controls and child seats. */
export interface LayoutTool {
  readonly body: (props: { readonly where: "header" | "closet" }) => JSX.Element
  readonly headerOrder: number
  readonly closetOrder: number
  readonly mobileWithoutSidebar?: boolean
}
export const tools = location<LayoutTool>("layout.tools")

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Accessor } from "solid-js"
export const deployment = serviceTag<{readonly called: Accessor<string | undefined>}>("layout.deployment")

/** Optional capability status can hold its content while initial data arrives,
 * and render its own diagnosis. Layout knows neither files nor domain errors. */
export const contentStatus = location<{readonly ready:()=>boolean;readonly Message:()=>JSX.Element}>("layout.content-status")

export const overlays = location<(props:{readonly toggleDirectory:()=>void})=>JSX.Element>("layout.overlays")

let panelHandle:(()=>JSX.Element)|undefined
export function holdPanelHandle(value:()=>JSX.Element):()=>void {
 panelHandle=value;return ()=>{if(panelHandle===value)panelHandle=undefined}
}
export function PanelHandle():JSX.Element {return panelHandle?.()}

export { slotContracts as slots } from "./slots.ts"
