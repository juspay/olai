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
import type { SetOptions } from "@olai/web/client/preference.ts"
import type { ChatSnap } from "./layout/prefs.ts"
/**
 * WHAT THIS DEPLOYMENT CALLS ITSELF, and how long it has been up.
 *
 * Both are one reading of one procedure (`app.get`), asked and re-asked by the
 * layout row's `deployment` component. `started` is BESIDE `called` rather than
 * on a second key because it is the same answer: a row that wants the uptime
 * and a row that wants the name are asking the same question of the same
 * activation.
 *
 * `startedAt` used to reach `olai-plugin-layout`'s own uptime readout, and
 * `calledApp` reached `olai-plugin-chat`'s notification title, through a module
 * variable in `@olai/web`'s `client/named.ts` — a live value on a general
 * package's door, installed by this row and read by another with nothing
 * declared (the Cordis audit's §12).
 */
export const deployment = serviceTag<{
  readonly called: Accessor<string | undefined>
  /** When this serve started, as the format's own stamp — `undefined` until
   *  the first answer lands. */
  readonly started: Accessor<string | undefined>
}>("layout.deployment")

/** Optional capability status can hold its content while initial data arrives,
 * and render its own diagnosis. Layout knows neither files nor domain errors. */
export const contentStatus = location<{readonly ready:()=>boolean;readonly Message:()=>JSX.Element}>("layout.content-status")

export const overlays = location<(props:{readonly toggleDirectory:()=>void})=>JSX.Element>("layout.overlays")

/**
 * THE SHELL'S GEOMETRY, as a row that draws inside it reads it.
 *
 * Six rows want some of this: whether the viewport is at the desktop
 * breakpoint, whether the right panel is open and how wide it is, whether the
 * directory column is a column or a rail, and the drag handle that resizes the
 * panel. Every one of them used to reach a module signal in `./layout/prefs.ts`
 * or `./layout/media.ts` — declared doors carrying live state — so none of them
 * declared a dependency on the shell, none of them stopped asking when it left,
 * and a serve with no layout row answered every question with a default that
 * reads exactly like an answer (the audit's §2 and §12).
 *
 * ## What it is NOT
 *
 * It is not the bar. `Bar` is the chrome's three facts about ONE PLACE — the
 * pill's classes, its breakpoint, its popover — and a row that draws a readout
 * up there names it. This is the shell's geometry, which is what a row drawing
 * a PAGE or a PANEL wants and is a different question; `desktop` is on both
 * because it is one media query and the two callers are asking it about
 * different things.
 *
 * It carries no `set` for the viewport and none for the breakpoint: those are
 * the window's answers, and this row is the one that listens for them.
 *
 * ## Absence
 *
 * A consumer names this on a COMPONENT of its own, never on its row: content
 * runs under another layout entirely (`olai-plugin-test-layout`,
 * `alternate_layout.feature`), so a row that waited for this one would be a row
 * that could not. With no shell mounted the readings answer what they have
 * always answered — a phone-width viewport, a shut panel, an open sidebar —
 * and the presses do nothing.
 */
export interface Shell {
  /** Is the viewport at the phone/desktop split? */
  readonly desktop: Accessor<boolean>
  readonly sidebarOpen: Accessor<boolean>
  readonly setSidebarOpen: (open: boolean) => void
  readonly toggleSidebar: () => void
  /** Live width, clamped to the current viewport. */
  readonly sidebarWidth: Accessor<number>
  readonly setSidebarWidth: (px: number, opts?: SetOptions) => void
  /** Is the right panel open? Minimized is the other of the two states. */
  readonly panelOpen: Accessor<boolean>
  readonly setPanelOpen: (open: boolean) => void
  readonly togglePanel: () => void
  readonly panelWidth: Accessor<number>
  readonly setPanelWidth: (px: number, opts?: SetOptions) => void
  readonly panelSnap: Accessor<ChatSnap>
  readonly setPanelSnap: (snap: ChatSnap) => void
  /** Put both panels back to their defaults — the palette's command. */
  readonly resetPanelWidths: () => void
  /** The panel's own drag handle, drawn by whoever is in the seat. The BOX is
   *  the shell's and what is inside it is the tenant's, so the handle travels
   *  with the geometry rather than as a slot the tenant fills. */
  readonly PanelHandle: () => JSX.Element
}
export const shell = serviceTag<Shell>("layout.shell")

export { slotContracts as slots } from "./slots.ts"
