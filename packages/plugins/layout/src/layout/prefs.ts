import type { SetOptions } from "@olai/web/client/preference.ts"

export const SIDEBAR_OPEN_KEY = "olai.sidebar.open"
export const SIDEBAR_WIDTH_KEY = "olai.sidebar.width"

export const RAIL_WIDTH_PX = 48

export const SIDEBAR_DEFAULT_PX = 272
export const SIDEBAR_MIN_PX = 180
export const SIDEBAR_MAX_PX = 480

export const MIN_MAIN_PX = 280

export const parsePx = (
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (raw === null) return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return clamp(Math.round(n), min, max)
}

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n))

export const fitSidebar = (
  sideRaw: number,
  sideOpen: boolean,
  viewport: number,
): number => {
  const side = clamp(sideRaw, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX)
  if (!sideOpen) return side
  const budget = Math.max(0, viewport - MIN_MAIN_PX)
  return clamp(side, Math.min(SIDEBAR_MIN_PX, budget), Math.min(SIDEBAR_MAX_PX, budget))
}

interface Preference<T> {readonly value:()=>T;readonly set:(value:T,opts?:SetOptions)=>void}
export interface LayoutPreferences {
 readonly sidebarOpenPref:Preference<boolean>;readonly sidebarWidthPref:Preference<number>
}
