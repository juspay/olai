/**
 * Layout preferences of this browser: whether the directory column is a full
 * column or an icon rail, and how wide it is.
 *
 * The column has exactly two states — open, or minimized-with-signal. Nothing
 * closes to nowhere. The width is the reader's, stored here and never sent over
 * the wire.
 *
 * A stored width can outlive the screen it was chosen on, so every *read*
 * clamps it against the current viewport so the outline cannot vanish under the
 * directory (e.g. 480 on a 600px window) — {@link fitSidebar}, which is pure
 * and is where that arithmetic is.
 *
 * ## NOTHING LIVE IS HERE ANY MORE
 *
 * This door used to carry the readings as well: two module signals (the
 * viewport width, and the preference circuits this browser's layout activation
 * installs) with fifteen accessors and setters over them, spelled by six other
 * packages. The value crossed every one of those walls as a module variable,
 * so no consumer declared a dependency on the shell and none of them stopped
 * asking when it left (the audit's §2 and §12).
 *
 * The readings are on `layout.shell` now (`../index.ts`'s {@link Shell}),
 * offered by this row's activation and declared by each consuming row on a
 * component of its own. What is left here is the KEYS, the BOUNDS and the
 * arithmetic — which is what a contract door is for, and is also what the e2e
 * suite reads of it.
 */

import type { SetOptions } from "@olai/web/client/preference.ts"

// ── keys ──────────────────────────────────────────────────────────────────

export const SIDEBAR_OPEN_KEY = "olai.sidebar.open"
export const SIDEBAR_WIDTH_KEY = "olai.sidebar.width"

// ── bounds & defaults ─────────────────────────────────────────────────────

export const SIDEBAR_DEFAULT_PX = 272
export const SIDEBAR_MIN_PX = 180
export const SIDEBAR_MAX_PX = 480

/** Minimum main-pane width so the outline stays the page. */
export const MIN_MAIN_PX = 280

// ── parse helpers (exported for unit tests) ───────────────────────────────
//
// What a stored BOOLEAN says is not one of them: that is the storage
// convention rather than anything about a column, so it lives beside the
// storage (`../preference.ts`) and is read by every stored boolean this
// browser keeps.

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

/**
 * Fit the directory column into a viewport, leaving room for the main pane.
 * Pure so unit tests hold the 600px window case without a window.
 *
 * A minimized column is the rail, which is a fixed face and no reader's
 * choice, so the stored width is handed back untouched: it is what the column
 * goes back to when it is opened again, on whatever screen that happens.
 */
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

/** The two preference circuits a layout activation installs — the shape
 *  `./prefs-owner.ts` builds and `./live.ts` holds. */
interface Preference<T> {readonly value:()=>T;readonly set:(value:T,opts?:SetOptions)=>void}
export interface LayoutPreferences {
 readonly sidebarOpenPref:Preference<boolean>;readonly sidebarWidthPref:Preference<number>
}
