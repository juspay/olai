/**
 * THE SHELL'S LIVE GEOMETRY — this row's own, and PRIVATE to this package.
 *
 * Three readings with one owner and one lifetime: whether the viewport is at
 * the desktop breakpoint, how wide the window is, and the five preference
 * circuits this browser's layout keeps. All three are installed by the layout
 * root's `activate` block (`../browser.tsx`) and released with it.
 *
 * They used to be module signals in `./prefs.ts` and `./media.ts` — declared
 * contract doors — and six other packages read them straight across the wall.
 * They cross on `layout.shell` now (`../index.ts`), and what stays here is this
 * row's own hold, installed by the same activation that offers the service so
 * that what the frame reads and what a sibling row is handed cannot be two
 * different states.
 *
 * `desktop()` reads `false` before the listener attaches and after it detaches,
 * which is the phone layout. It is not a state a reader reaches: every face
 * that asks is drawn inside the frame this same activation contributes.
 */
import { type Accessor, createSignal } from "solid-js"

import type { SetOptions } from "@olai/web/client/preference.ts"

import {
  CHAT_DEFAULT_PX,
  type ChatSnap,
  clamp,
  fitWidths,
  type LayoutPreferences,
  PANEL_MAX_PX,
  PANEL_MIN_PX,
  SIDEBAR_DEFAULT_PX,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
} from "./prefs.ts"

const [isDesktop, setIsDesktop] = createSignal(false)

/** Is the viewport at the phone/desktop split? */
export const desktop: Accessor<boolean> = isDesktop

export const publishDesktop = (value: boolean): void => { setIsDesktop(value) }

const [viewportWidth, setViewportWidth] = createSignal(10_000)



// ── the five circuits, one factory ────────────────────────────────────────
//
// Each preference is its codec and nothing else; the read→signal→write→watch
// wiring is `createPreference`'s (../preference.ts). The setters below stay,
// because they are where a VALUE is decided — a width is clamped before it is
// a width — and the accessors stay because a width is fitted to the viewport
// on the way out, which is a fact about layout and not about storage.

const [active,setActive]=createSignal<LayoutPreferences>()
export const holdLayoutPreferences=(value:LayoutPreferences):(()=>void)=>{setActive(value);return()=>{if(active()===value)setActive(undefined)}}
export const publishViewportWidth=(value:number):void=>{setViewportWidth(value)}
// ── sidebar open (desktop: full column vs icon rail) ──────────────────────

export const sidebarOpen: Accessor<boolean> = () => active()?.sidebarOpenPref.value() ?? true

export const setSidebarOpen = (open: boolean): void => active()?.sidebarOpenPref.set(open)

export const toggleSidebar = (): void => setSidebarOpen(!sidebarOpen())

// ── sidebar width ─────────────────────────────────────────────────────────

/** Live width, clamped to the current viewport. */
export const sidebarWidth: Accessor<number> = () =>
  fitWidths(
    (active()?.sidebarWidthPref.value() ?? SIDEBAR_DEFAULT_PX),
    (active()?.panelWidthPref.value() ?? CHAT_DEFAULT_PX),
    sidebarOpen(),
    panelOpen(),
    viewportWidth(),
  ).side

/**
 * Set the sidebar width. During a drag pass `{ persist: false }` so every
 * pointermove does not write localStorage (and fire cross-tab storage events);
 * the handle's `onEnd` persists once.
 */
export const setSidebarWidth = (px: number, opts?: SetOptions): void =>
  active()?.sidebarWidthPref.set(clamp(Math.round(px), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX), opts)

// ── chat open (open dock/sheet vs minimized pill/strip) ───────────────────

/** Is the agent panel open right now? Minimized is the other of the two states. */
export const panelOpen: Accessor<boolean> = () => active()?.panelOpenPref.value() ?? false

export const setPanelOpen = (open: boolean): void => active()?.panelOpenPref.set(open)

export const togglePanel = (): void => setPanelOpen(!panelOpen())

// ── chat width ────────────────────────────────────────────────────────────

/** Live width, clamped to the current viewport. */
export const panelWidth: Accessor<number> = () =>
  fitWidths(
    (active()?.sidebarWidthPref.value() ?? SIDEBAR_DEFAULT_PX),
    (active()?.panelWidthPref.value() ?? CHAT_DEFAULT_PX),
    sidebarOpen(),
    panelOpen(),
    viewportWidth(),
  ).chat

export const setPanelWidth = (px: number, opts?: SetOptions): void =>
  active()?.panelWidthPref.set(clamp(Math.round(px), PANEL_MIN_PX, PANEL_MAX_PX), opts)

/** Reset both panels to their defaults (palette command for keyboard users). */
export const resetPanelWidths = (): void => {
  setSidebarWidth(SIDEBAR_DEFAULT_PX)
  setPanelWidth(CHAT_DEFAULT_PX)
}

// ── mobile chat snap ──────────────────────────────────────────────────────

export const panelSnap: Accessor<ChatSnap> = () => active()?.panelSnapPref.value() ?? "half"

export const setPanelSnap = (snap: ChatSnap): void => active()?.panelSnapPref.set(snap)

