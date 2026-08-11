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
 * the dock (e.g. 480 + 720 on a 1024px laptop).
 */

import { type Accessor, createSignal } from "solid-js"

import {
  readPreference,
  watchPreference,
  writePreference,
} from "../preference.ts"

// ── keys ──────────────────────────────────────────────────────────────────

export const SIDEBAR_OPEN_KEY = "olai.sidebar.open"
export const SIDEBAR_WIDTH_KEY = "olai.sidebar.width"
export const CHAT_OPEN_KEY = "olai.chat.open"
export const CHAT_WIDTH_KEY = "olai.chat.width"
export const CHAT_SNAP_KEY = "olai.chat.snap"

// ── bounds & defaults ─────────────────────────────────────────────────────

/** Fixed face of a minimized desktop sidebar. Matches `--width-rail`. */
export const RAIL_WIDTH_PX = 48

export const SIDEBAR_DEFAULT_PX = 256
export const SIDEBAR_MIN_PX = 180
export const SIDEBAR_MAX_PX = 480

export const CHAT_DEFAULT_PX = 416
export const CHAT_MIN_PX = 280
export const CHAT_MAX_PX = 720

/** Minimum main-pane width so the outline stays the page. */
export const MIN_MAIN_PX = 280

export type ChatSnap = "half" | "full"

// ── parse helpers (exported for unit tests) ───────────────────────────────

export const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback
  return raw === "true"
}

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
  chatOpen: boolean,
  viewport: number,
): { readonly side: number; readonly chat: number } => {
  const sideTaken = sideOpen ? 0 : RAIL_WIDTH_PX
  // When the full sidebar is open it takes `side`; when closed, the rail.
  let side = clamp(sideRaw, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX)
  let chat = clamp(chatRaw, CHAT_MIN_PX, CHAT_MAX_PX)

  if (sideOpen && chatOpen) {
    const budget = Math.max(0, viewport - MIN_MAIN_PX)
    if (side + chat > budget) {
      // Shrink chat first (the overlay), then the sidebar. Keep both at their
      // design mins when the viewport allows; only go below on a phone-width
      // desktop scale that cannot hold them.
      if (SIDEBAR_MIN_PX + CHAT_MIN_PX <= budget) {
        chat = clamp(chat, CHAT_MIN_PX, budget - SIDEBAR_MIN_PX)
        side = clamp(side, SIDEBAR_MIN_PX, budget - chat)
        chat = clamp(chat, CHAT_MIN_PX, budget - side)
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

  if (chatOpen) {
    const budget = Math.max(0, viewport - MIN_MAIN_PX - sideTaken)
    return {
      side,
      chat: clamp(chat, Math.min(CHAT_MIN_PX, budget), Math.min(CHAT_MAX_PX, budget)),
    }
  }

  return { side, chat }
}

const viewportWidth = (): number =>
  typeof window !== "undefined" ? window.innerWidth : 10_000

// ── sidebar open (desktop: full column vs icon rail) ──────────────────────

const [isSidebarOpen, setSidebarOpenSignal] = createSignal(
  parseBool(readPreference(SIDEBAR_OPEN_KEY), true),
)

export const sidebarOpen: Accessor<boolean> = isSidebarOpen

export const setSidebarOpen = (open: boolean): void => {
  setSidebarOpenSignal(open)
  writePreference(SIDEBAR_OPEN_KEY, String(open))
}

export const toggleSidebar = (): void => setSidebarOpen(!sidebarOpen())

// ── sidebar width ─────────────────────────────────────────────────────────

const [sidebarWidthPx, setSidebarWidthSignal] = createSignal(
  parsePx(
    readPreference(SIDEBAR_WIDTH_KEY),
    SIDEBAR_DEFAULT_PX,
    SIDEBAR_MIN_PX,
    SIDEBAR_MAX_PX,
  ),
)

/** Live width, clamped to the current viewport. */
export const sidebarWidth: Accessor<number> = () =>
  fitWidths(
    sidebarWidthPx(),
    chatWidthPx(),
    sidebarOpen(),
    chatOpen(),
    viewportWidth(),
  ).side

/**
 * Set the sidebar width. During a drag pass `{ persist: false }` so every
 * pointermove does not write localStorage (and fire cross-tab storage events);
 * the handle's `onEnd` persists once.
 */
export const setSidebarWidth = (
  px: number,
  opts?: { readonly persist?: boolean },
): void => {
  const next = clamp(Math.round(px), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX)
  setSidebarWidthSignal(next)
  if (opts?.persist !== false) writePreference(SIDEBAR_WIDTH_KEY, String(next))
}

// ── chat open (open dock/sheet vs minimized pill/strip) ───────────────────

const [isChatOpen, setChatOpenSignal] = createSignal(
  parseBool(readPreference(CHAT_OPEN_KEY), false),
)

/** Is the agent panel open right now? Minimized is the other of the two states. */
export const chatOpen: Accessor<boolean> = isChatOpen

export const setChatOpen = (open: boolean): void => {
  setChatOpenSignal(open)
  writePreference(CHAT_OPEN_KEY, String(open))
}

export const toggleChat = (): void => setChatOpen(!chatOpen())

// ── chat width ────────────────────────────────────────────────────────────

const [chatWidthPx, setChatWidthSignal] = createSignal(
  parsePx(
    readPreference(CHAT_WIDTH_KEY),
    CHAT_DEFAULT_PX,
    CHAT_MIN_PX,
    CHAT_MAX_PX,
  ),
)

/** Live width, clamped to the current viewport. */
export const chatWidth: Accessor<number> = () =>
  fitWidths(
    sidebarWidthPx(),
    chatWidthPx(),
    sidebarOpen(),
    chatOpen(),
    viewportWidth(),
  ).chat

export const setChatWidth = (
  px: number,
  opts?: { readonly persist?: boolean },
): void => {
  const next = clamp(Math.round(px), CHAT_MIN_PX, CHAT_MAX_PX)
  setChatWidthSignal(next)
  if (opts?.persist !== false) writePreference(CHAT_WIDTH_KEY, String(next))
}

/** Reset both panels to their defaults (palette command for keyboard users). */
export const resetPanelWidths = (): void => {
  setSidebarWidth(SIDEBAR_DEFAULT_PX)
  setChatWidth(CHAT_DEFAULT_PX)
}

// ── mobile chat snap ──────────────────────────────────────────────────────

const [chatSnapValue, setChatSnapSignal] = createSignal<ChatSnap>(
  parseSnap(readPreference(CHAT_SNAP_KEY)),
)

export const chatSnap: Accessor<ChatSnap> = chatSnapValue

export const setChatSnap = (snap: ChatSnap): void => {
  setChatSnapSignal(snap)
  writePreference(CHAT_SNAP_KEY, snap)
}

// ── cross-tab follow ──────────────────────────────────────────────────────

/**
 * Follow every layout preference for as long as this document lives.
 *
 * Same shape as `followStoredTheme`: started from `main.tsx` once. Also
 * re-fits widths when the viewport resizes so a laptop undock cannot leave
 * the outline under the dock.
 */
export const followLayout = (): void => {
  watchPreference(SIDEBAR_OPEN_KEY, (value) => {
    setSidebarOpenSignal(parseBool(value, true))
  })
  watchPreference(SIDEBAR_WIDTH_KEY, (value) => {
    setSidebarWidthSignal(
      parsePx(value, SIDEBAR_DEFAULT_PX, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX),
    )
  })
  watchPreference(CHAT_OPEN_KEY, (value) => {
    setChatOpenSignal(parseBool(value, false))
  })
  watchPreference(CHAT_WIDTH_KEY, (value) => {
    setChatWidthSignal(parsePx(value, CHAT_DEFAULT_PX, CHAT_MIN_PX, CHAT_MAX_PX))
  })
  watchPreference(CHAT_SNAP_KEY, (value) => {
    setChatSnapSignal(parseSnap(value))
  })

  // Re-read fit on resize: accessors re-run when signals change, but a bare
  // window resize does not touch a signal. Nudge a signal with its own value
  // so Solid re-renders consumers of sidebarWidth/chatWidth.
  const onResize = () => {
    setSidebarWidthSignal((w) => w)
    setChatWidthSignal((w) => w)
  }
  window.addEventListener("resize", onResize)
}
