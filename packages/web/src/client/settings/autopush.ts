/**
 * Whether a commit from THIS browser's Commit button is followed by a push.
 *
 * A claim about the READER rather than about the directory — "I want a commit
 * I make here to be sent" — so it lives here, with the other preferences, is
 * stored in this browser, and reaches the server never. Agent `commit` ops and
 * `--commit=auto` are server-side and do not read it.
 *
 * Off for a browser that has never been asked: today's behaviour, a commit
 * waits and the panel's Push sends it. The circuit is `../preference.ts`.
 * Cross-tab follow is the same `storage` event the theme and the folds ride,
 * started once from `main.tsx`.
 */

import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const AUTOPUSH_KEY = "olai.git.autopush"

/** Off, for a browser that has never been asked — and for a value nothing
 *  here ever wrote, which is `boolCodec`'s rule and not this file's. */
const OFF = false

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(AUTOPUSH_KEY, boolCodec(OFF))

/** Whether this browser follows a commit with a push. */
export const autoPush: Accessor<boolean> = pref.value

/** Persist on change — `pref.set` writes `olai.git.autopush`. */
export const setAutoPush = (value: boolean): void => pref.set(value)

/** Follow it for as long as this document lives — the same shape as
 *  `followDoneHidden` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. */
export const followAutoPush = (): void => {
  pref.follow()
}
