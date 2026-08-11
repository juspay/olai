/**
 * Layout preferences of this browser: which panels are open, how wide they
 * are, and which snap the mobile chat sheet is on.
 *
 * Every panel has exactly two states — open, or minimized-with-signal. Nothing
 * closes to nowhere. Widths and the chat snap point are the reader's, stored
 * here and never sent over the wire (the same contract as the theme and the
 * agent drawer that used to live alone in `chat/open.ts`).
 *
 * Defaults match what shipped before this rework: a 16rem directory column, a
 * 26rem chat drawer, both open. The rail width is not a preference — it is the
 * fixed collapsed face of the sidebar (~3rem).
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

export type ChatSnap = "half" | "full"

// ── parse helpers ─────────────────────────────────────────────────────────

const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback
  return raw === "true"
}

const parsePx = (
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

const parseSnap = (raw: string | null): ChatSnap =>
  raw === "full" ? "full" : "half"

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n))

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

export const sidebarWidth: Accessor<number> = sidebarWidthPx

export const setSidebarWidth = (px: number): void => {
  const next = clamp(Math.round(px), SIDEBAR_MIN_PX, SIDEBAR_MAX_PX)
  setSidebarWidthSignal(next)
  writePreference(SIDEBAR_WIDTH_KEY, String(next))
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

export const chatWidth: Accessor<number> = chatWidthPx

export const setChatWidth = (px: number): void => {
  const next = clamp(Math.round(px), CHAT_MIN_PX, CHAT_MAX_PX)
  setChatWidthSignal(next)
  writePreference(CHAT_WIDTH_KEY, String(next))
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
 * Same shape as `followChatOpen` / `followStoredTheme`: started from `main.tsx`
 * once, beside the other document-lifetime listeners. The writing tab has
 * already applied its own pick; these only apply what another tab left.
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
}
