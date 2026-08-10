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
 * a page you are reading, and a drawer belongs to the window.)
 *
 * Storage can throw — a browser with it disabled, a private window at quota —
 * and a panel that could not be opened because a preference could not be saved
 * would be a poor trade. That contract is `../preference.ts`'s, shared with
 * the theme: both degrade to "the default, this session".
 */

import { type Accessor, createSignal } from "solid-js"

import { readPreference, writePreference } from "../preference.ts"

const KEY = "olai.chat.open"

const [isOpen, setOpen] = createSignal(readPreference(KEY) === "true")

/** Is the agent panel open right now? */
export const chatOpen: Accessor<boolean> = isOpen

export const setChatOpen = (open: boolean): void => {
  setOpen(open)
  writePreference(KEY, String(open))
}
