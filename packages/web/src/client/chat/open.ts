/**
 * Whether the panel is open — one signal for the whole document.
 *
 * MODULE-SCOPED rather than per-component, because two things read it and only
 * one of them is the panel. The other is the LAYOUT: the drawer is fixed, so a
 * page that did not know it was open would draw its right-hand third
 * underneath it, and the reader would have to shut the agent to finish a
 * sentence. `App.tsx` reserves the width instead. That is a small coupling and
 * it is the honest one — "the outline is the page" is a claim the layout has to
 * make, and it cannot make it without knowing.
 *
 * Stored in `localStorage`, because it belongs to this browser's reading and
 * not to the served directory: nothing about it is sent anywhere, and two
 * machines are entitled to disagree. (The collapse state is the same KIND of
 * fact and is deliberately NOT stored — see `view.ts`: a folded row belongs to
 * a page you are reading, and a drawer belongs to the browser.)
 *
 * To the BROWSER, and that is the whole of why the listener below is not a
 * contradiction of the line above: storing it already made it one fact across
 * every tab — a second tab opened after the drawer was has always come up with
 * it open. What the listener changes is only WHEN a tab finds out, from "the
 * next time it loads" to "now", which is the same promise the theme makes and
 * the same one `clock.ts` makes about the day.
 *
 * Storage can throw — a browser with it disabled, a private window at quota —
 * and a panel that could not be opened because a preference could not be saved
 * would be a poor trade. That contract is `../preference.ts`'s, shared with
 * the theme: both degrade to "the default, this session".
 */

import { type Accessor, createSignal } from "solid-js"

import { readPreference, watchPreference, writePreference } from "../preference.ts"

const KEY = "olai.chat.open"

const [isOpen, setOpen] = createSignal(readPreference(KEY) === "true")

/**
 * Follow the drawer for as long as the document lives: a browser is more than
 * one tab, and this is one of that browser's preferences, so opening the drawer
 * next door opens it here.
 *
 * Called from the entry point rather than run on import, which is where this
 * client starts everything that belongs to the DOCUMENT (`main.tsx`, beside
 * `trackVisibleViewport` and `followStoredTheme`). Not a style rule: a listener
 * attached by importing a module is a listener attached wherever the module is
 * imported, and the first unit test to reach this one through an import would
 * find `window` missing and fail somewhere else entirely.
 *
 * `setOpen` rather than the verb above, because the tab that made the pick is
 * the one that stores it — writing it back would be this tab answering an event
 * with an event.
 */
export const followChatOpen = (): void => {
  watchPreference(KEY, (value) => setOpen(value === "true"))
}

/** Is the agent panel open right now? */
export const chatOpen: Accessor<boolean> = isOpen

export const setChatOpen = (open: boolean): void => {
  setOpen(open)
  writePreference(KEY, String(open))
}
