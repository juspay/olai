/**
 * What a page starts out drawing: everything, or everything that is not done.
 *
 * This is the DEFAULT for the per-view Done switch (`../view.ts`), and the
 * distinction is the whole of the design. A reading belongs to a page — zoom
 * somewhere and you are reading a new thing, so the switch starts fresh — but
 * "I do not want to look at finished work" is a claim about the READER rather
 * than about any one page, and re-pressing it on every page you open is the
 * kind of thing a preference exists to stop.
 *
 * So a reading holds `undefined` until somebody presses the switch on that
 * page, and `undefined` reads this. Two things follow, and both are what a
 * default ought to do: changing it here moves every page nobody has pressed the
 * switch on — including the one on screen, which is the difference between a
 * preference and a thing that takes effect next time — and a page somebody HAS
 * pressed it on is left exactly as they left it.
 *
 * Nothing is written to the outlines by any of this, on either side of the
 * switch: a hidden row is a row this reading does not draw (`../view.ts`), and
 * a preference belongs to this browser (`../preference.ts`) and reaches no
 * server.
 */

import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const DONE_HIDDEN_KEY = "olai.done.hidden"

/** Shown, for a browser that has never been asked — and for a value nothing
 *  here ever wrote, which is `boolCodec`'s rule and not this file's. */
const SHOWN = false

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(DONE_HIDDEN_KEY, boolCodec(SHOWN))

/** Whether a page nobody has pressed the Done switch on hides what is done. */
export const doneHiddenDefault: Accessor<boolean> = pref.value

export const setDoneHiddenDefault = (value: boolean): void => pref.set(value)

/** Follow it for as long as this document lives — the same shape as
 *  `followStoredTheme` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. */
export const followDoneDefault = (): void => {
  pref.follow()
}
