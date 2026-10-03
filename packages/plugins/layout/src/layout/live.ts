/**
 * THE SHELL'S LIVE GEOMETRY — this row's own, and PRIVATE to this package.
 *
 * Three readings with one owner and one lifetime: whether the viewport is at
 * the desktop breakpoint, how wide the window is, and the four preference
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

import { heldService } from "@olai/ui-primitives/held.ts"
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

/** Installed before geometry listeners and withdrawn after them. */
export const createLayoutState = () => {
  const [desktop, setDesktop] = createSignal(false)
  const [width, setWidth] = createSignal(10_000)
  const [prefs, setPreferences] = createSignal<LayoutPreferences>()
  const [drawer, setDrawer] = createSignal(false)
  return { desktop, setDesktop, width, setWidth, prefs, setPreferences, drawer, setDrawer }
}
const held = heldService<ReturnType<typeof createLayoutState>>()
export const holdLayoutState = held.hold
const state = held.read
export const desktop: Accessor<boolean> = () => state()?.desktop() ?? false
export const publishDesktop = (value: boolean): void => { state()?.setDesktop(value) }
const viewportWidth = () => state()?.width() ?? 10_000

// ── the four circuits, one factory ────────────────────────────────────────
//
// Each preference is its codec and nothing else; the read→signal→write→watch
// wiring is `createPreference`'s (../preference.ts). The setters below stay,
// because they are where a VALUE is decided — a width is clamped before it is
// a width — and the accessors stay because a width is fitted to the viewport
// on the way out, which is a fact about layout and not about storage.

const active = () => state()?.prefs()
export const holdLayoutPreferences = (value: LayoutPreferences): (() => void) => {
  const owner = state()
  owner?.setPreferences(value)
  return () => { if (owner?.prefs() === value) owner?.setPreferences(undefined) }
}
export const publishViewportWidth = (value: number): void => { state()?.setWidth(value) }
// ── sidebar open (desktop: full column vs icon rail) ──────────────────────

export const sidebarOpen: Accessor<boolean> = () => active()?.sidebarOpenPref.value() ?? true

export const setSidebarOpen = (open: boolean): void => active()?.sidebarOpenPref.set(open)

export const toggleSidebar = (): void => setSidebarOpen(!sidebarOpen())

// ── the phone drawer (the sidebar below the breakpoint) ───────────────────
//
// Not a preference: a drawer is open for one errand and shut by the next tap,
// so nothing stores it. Owned by the frame that draws it (`../Frame.tsx`),
// which shuts it when it unmounts and whenever the viewport becomes a desktop.

/** Is the phone's sidebar drawer open? Always `false` on a desktop. */
export const drawerOpen: Accessor<boolean> = () => state()?.drawer() ?? false

export const setDrawerOpen = (open: boolean): void => { state()?.setDrawer(open) }

/** Put the sidebar where a person can see it: the column on a desktop (out of
 *  its rail), the drawer on a phone. For a control OUTSIDE the sidebar that
 *  opens something IN it — an empty page's `New outline` opening the files
 *  row's path box. */
export const revealSidebar = (): void => {
  if (desktop()) setSidebarOpen(true)
  else setDrawerOpen(true)
}

// ── sidebar width ─────────────────────────────────────────────────────────

/** Live width, clamped to the current viewport. */
export const sidebarWidth: Accessor<number> = () =>
  fitWidths(
    (active()?.sidebarWidthPref.value() ?? SIDEBAR_DEFAULT_PX),
    (active()?.panelWidthPref.value() ?? CHAT_DEFAULT_PX),
    sidebarOpen(),
    // No open/shut state for the seat's panel: nothing opens it any more
    // (the chord and its palette row left with the chat dock), so the
    // sidebar is never squeezed for a panel that is not drawn.
    false,
    viewportWidth(),
  ).side

/**
 * Set the sidebar width. During a drag pass `{ persist: false }` so every
 * pointermove does not write localStorage (and fire cross-tab storage events);
 * the handle's `onEnd` persists once.
 */
export const setSidebarWidth = (px: number, opts?: SetOptions): void =>
  active()?.sidebarWidthPref.set(clamp(Math.round(px), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX), opts)

// ── chat width ────────────────────────────────────────────────────────────

/** Live width, clamped to the current viewport. */
export const panelWidth: Accessor<number> = () =>
  fitWidths(
    (active()?.sidebarWidthPref.value() ?? SIDEBAR_DEFAULT_PX),
    (active()?.panelWidthPref.value() ?? CHAT_DEFAULT_PX),
    sidebarOpen(),
    // No open/shut state for the seat's panel: nothing opens it any more
    // (the chord and its palette row left with the chat dock), so the
    // sidebar is never squeezed for a panel that is not drawn.
    false,
    viewportWidth(),
  ).chat

export const setPanelWidth = (px: number, opts?: SetOptions): void =>
  active()?.panelWidthPref.set(clamp(Math.round(px), PANEL_MIN_PX, PANEL_MAX_PX), opts)

/** Reset the sidebar (and the seat's panel) to default widths — the palette's
 *  "Reset sidebar width", for keyboard users. */
export const resetPanelWidths = (): void => {
  setSidebarWidth(SIDEBAR_DEFAULT_PX)
  setPanelWidth(CHAT_DEFAULT_PX)
}

// ── mobile chat snap ──────────────────────────────────────────────────────

export const panelSnap: Accessor<ChatSnap> = () => active()?.panelSnapPref.value() ?? "half"

export const setPanelSnap = (snap: ChatSnap): void => active()?.panelSnapPref.set(snap)

