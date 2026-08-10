/**
 * Whether the panel is open — one signal for the whole document.
 *
 * MODULE-SCOPED rather than per-component, because two things read it and only
 * one of them is the panel. The connection dot lives in the bottom-right corner
 * and the panel is a right-hand drawer, so an open panel would sit underneath
 * it; the dot steps aside instead of being covered. That is a small coupling
 * and it is the honest one: "always on screen" is the dot's whole promise, and
 * a promise kept by z-index alone is one a drawer can break.
 *
 * Stored in `localStorage`, because it belongs to this browser's reading and
 * not to the served directory: nothing about it is sent anywhere, and two
 * machines are entitled to disagree. (The collapse state is the same KIND of
 * fact and is deliberately NOT stored — see `view.ts`: a folded row belongs to
 * a page you are reading, and a drawer belongs to the window.)
 *
 * Storage can throw — a browser with it disabled, a private window at quota —
 * and a panel that could not be opened because a preference could not be saved
 * would be a poor trade. Both halves degrade to "the default, this session".
 */

import { type Accessor, createSignal } from "solid-js"

const KEY = "olai.chat.open"

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "true"
  } catch {
    return false
  }
}

const [isOpen, setOpen] = createSignal(read())

/** Is the agent panel open right now? */
export const chatOpen: Accessor<boolean> = isOpen

export const setChatOpen = (open: boolean): void => {
  setOpen(open)
  try {
    localStorage.setItem(KEY, String(open))
  } catch {
    // A preference that cannot be stored is still a preference for this tab.
  }
}
