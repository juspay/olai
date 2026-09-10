/**
 * Layout preferences of this browser: which panels are open, how wide they
 * are, and which snap the mobile chat sheet is on.
 *
 * Every panel has exactly two states — open, or minimized-with-signal. Nothing
 * closes to nowhere. Widths and the chat snap point are the reader's, stored
 * here and never sent over the wire.
 *
 * Stored widths can outlive the screen they were chosen on, so every *read*
 * clamps them against the current viewport so the outline cannot vanish under
 * the dock (e.g. 480 + 720 on a 1024px laptop) — {@link fitWidths}, which is
 * pure and is where that arithmetic is.
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
/**
 * THE RIGHT PANEL'S THREE, and the names and the STORED WORDS deliberately
 * disagree.
 *
 * The identifiers say `PANEL` because that is what this file knows: the seat on
 * the right of the page, its width, whether it is open and where it snaps are
 * facts about THIS APP'S LAYOUT, and they survive whichever plugin is in the
 * seat. What used to be in it was the chat, and this file was named after it —
 * which is a general package spelling a plugin, and `@olai/bundle`'s
 * `fence.test.ts` is what refuses that.
 *
 * The STORED words stay `olai.chat.*`, and that is not an oversight left in the
 * middle of a rename. A preference key is a promise to a browser that already
 * has one: renaming it would silently forget the panel width every reader has
 * dragged and every pick of open-or-shut, on the release that shipped the
 * rename, with nothing anywhere saying so. There is no migration worth writing
 * for three booleans, and there is no version of "read the old key once and
 * write the new one" that does not leave both keys in every browser for ever.
 *
 * So the words are kept and the fence is told: `fence.test.ts` records this file
 * as a place the word `chat` appears and is not a plugin's name, beside the two
 * collisions the engines already produce.
 */
export const PANEL_OPEN_KEY = "olai.chat.open"
export const PANEL_WIDTH_KEY = "olai.chat.width"
export const PANEL_SNAP_KEY = "olai.chat.snap"

// ── bounds & defaults ─────────────────────────────────────────────────────

/** Fixed face of a minimized desktop sidebar. Matches `--width-rail`. */
export const RAIL_WIDTH_PX = 48

export const SIDEBAR_DEFAULT_PX = 320
export const SIDEBAR_MIN_PX = 180
export const SIDEBAR_MAX_PX = 480

export const CHAT_DEFAULT_PX = 416
export const PANEL_MIN_PX = 280
export const PANEL_MAX_PX = 720

/** Minimum main-pane width so the outline stays the page. */
export const MIN_MAIN_PX = 280

export type ChatSnap = "half" | "full"

// ── parse helpers (exported for unit tests) ───────────────────────────────
//
// What a stored BOOLEAN says is not one of them: that is the storage
// convention rather than anything about a panel, so it lives beside the
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

export const parseSnap = (raw: string | null): ChatSnap =>
  raw === "full" ? "full" : "half"

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n))

/**
 * Fit a sidebar + chat pair into a viewport, leaving room for the main pane.
 * Pure so unit tests hold the 1024px laptop case without a window.
 */
export const fitWidths = (
  sideRaw: number,
  chatRaw: number,
  sideOpen: boolean,
  panelOpen: boolean,
  viewport: number,
): { readonly side: number; readonly chat: number } => {
  const sideTaken = sideOpen ? 0 : RAIL_WIDTH_PX
  // When the full sidebar is open it takes `side`; when closed, the rail.
  let side = clamp(sideRaw, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX)
  let chat = clamp(chatRaw, PANEL_MIN_PX, PANEL_MAX_PX)

  if (sideOpen && panelOpen) {
    const budget = Math.max(0, viewport - MIN_MAIN_PX)
    if (side + chat > budget) {
      // Shrink chat first (the overlay), then the sidebar. Keep both at their
      // design mins when the viewport allows; only go below on a phone-width
      // desktop scale that cannot hold them.
      if (SIDEBAR_MIN_PX + PANEL_MIN_PX <= budget) {
        chat = clamp(chat, PANEL_MIN_PX, budget - SIDEBAR_MIN_PX)
        side = clamp(side, SIDEBAR_MIN_PX, budget - chat)
        chat = clamp(chat, PANEL_MIN_PX, budget - side)
      } else {
        chat = clamp(chat, 0, budget)
        side = clamp(side, 0, budget - chat)
      }
    }
    return { side, chat }
  }

  if (sideOpen) {
    const budget = Math.max(0, viewport - MIN_MAIN_PX)
    return {
      side: clamp(side, Math.min(SIDEBAR_MIN_PX, budget), Math.min(SIDEBAR_MAX_PX, budget)),
      chat,
    }
  }

  if (panelOpen) {
    const budget = Math.max(0, viewport - MIN_MAIN_PX - sideTaken)
    return {
      side,
      chat: clamp(chat, Math.min(PANEL_MIN_PX, budget), Math.min(PANEL_MAX_PX, budget)),
    }
  }

  return { side, chat }
}

/** The five preference circuits a layout activation installs — the shape
 *  `./prefs-owner.ts` builds and `./live.ts` holds. */
interface Preference<T> {readonly value:()=>T;readonly set:(value:T,opts?:SetOptions)=>void}
export interface LayoutPreferences {
 readonly sidebarOpenPref:Preference<boolean>;readonly sidebarWidthPref:Preference<number>
 readonly panelOpenPref:Preference<boolean>;readonly panelWidthPref:Preference<number>;readonly panelSnapPref:Preference<ChatSnap>
}
