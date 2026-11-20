import { type Accessor, createSignal } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { SetOptions } from "@olai/web/client/preference.ts"

import {
  clamp,
  fitSidebar,
  type LayoutPreferences,
  SIDEBAR_DEFAULT_PX,
  SIDEBAR_MAX_PX,
  SIDEBAR_MIN_PX,
} from "./prefs.ts"

type Lease = () => void

export const createLayoutState = () => {
  const [desktop, setDesktop] = createSignal(false)
  const [width, setWidth] = createSignal(10_000)
  const [prefs, setPreferences] = createSignal<LayoutPreferences>()
  const [drawer, setDrawer] = createSignal(false)
  const [stripLeases, setStripLeases] = createSignal(0)
  return { desktop, setDesktop, width, setWidth, prefs, setPreferences, drawer, setDrawer, stripLeases, setStripLeases }
}
const held = heldService<ReturnType<typeof createLayoutState>>()
export const holdLayoutState = held.hold
const state = held.read
export const desktop: Accessor<boolean> = () => state()?.desktop() ?? false
export const publishDesktop = (value: boolean): void => { state()?.setDesktop(value) }
const viewportWidth = () => state()?.width() ?? 10_000

export const phoneTabs: Accessor<boolean> = () => (state()?.stripLeases() ?? 0) > 0

export const holdPhoneTabs = (): Lease => {
  const owner = state()
  owner?.setStripLeases((leases) => leases + 1)
  return () => { owner?.setStripLeases((leases) => Math.max(0, leases - 1)) }
}

const active = () => state()?.prefs()
export const holdLayoutPreferences = (value: LayoutPreferences): Lease => {
  const owner = state()
  owner?.setPreferences(value)
  return () => { if (owner?.prefs() === value) owner?.setPreferences(undefined) }
}
export const publishViewportWidth = (value: number): void => { state()?.setWidth(value) }

export const sidebarOpen: Accessor<boolean> = () => active()?.sidebarOpenPref.value() ?? true

export const setSidebarOpen = (open: boolean): void => active()?.sidebarOpenPref.set(open)

export const toggleSidebar = (): void => setSidebarOpen(!sidebarOpen())

export const drawerOpen: Accessor<boolean> = () => state()?.drawer() ?? false

export const setDrawerOpen = (open: boolean): void => { state()?.setDrawer(open) }

export const revealSidebar = (): void => {
  if (desktop()) setSidebarOpen(true)
  else setDrawerOpen(true)
}

export const sidebarWidth: Accessor<number> = () =>
  fitSidebar(active()?.sidebarWidthPref.value() ?? SIDEBAR_DEFAULT_PX, sidebarOpen(), viewportWidth())

export const setSidebarWidth = (px: number, opts?: SetOptions): void =>
  active()?.sidebarWidthPref.set(clamp(Math.round(px), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX), opts)

export const resetSidebarWidth = (): void => setSidebarWidth(SIDEBAR_DEFAULT_PX)
