/**
 * Whether this browser records what is waiting on its own, once the edits stop
 * arriving.
 *
 * The claim is about the READER, exactly as Auto-push beside it is — "I do not
 * want to press Commit" — so it lives here with the other preferences, is
 * stored in this browser, and reaches the server never. `--commit=auto` is the
 * SERVER's answer to a neighbouring question and is not this: that one commits
 * every write on its own, one commit per op, for a headless serve with nobody
 * there to ask. This one waits for a train of thought to finish and records it
 * as ONE commit, which is the whole reason the default mode is manual.
 *
 * WHAT IT SWEEPS is everything waiting, whoever wrote it — the same sweep the
 * Commit button makes, because it is the same verb. An agent writing over MCP
 * moves what is pending, so its writes restart the quiet window and land in the
 * same commit; that is the goal in the human's words ("all their changes"), and
 * it is a consequence of reading the published pending value rather than
 * counting anything here.
 *
 * Off for a browser that has never been asked: today's behaviour, a write waits
 * and the pill's Commit records it. The circuit is `../preference.ts`; the
 * trigger and the stop are `../commit/auto.ts`.
 */

import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const AUTOCOMMIT_KEY = "olai.git.autocommit"

/** Off, for a browser that has never been asked — and for a value nothing here
 *  ever wrote, which is `boolCodec`'s rule and not this file's. */
const OFF = false

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(AUTOCOMMIT_KEY, boolCodec(OFF))

/** Whether this browser records a finished flurry on its own. */
export const autoCommit: Accessor<boolean> = pref.value

/** Persist on change — `pref.set` writes `olai.git.autocommit`. */
export const setAutoCommit = (value: boolean): void => pref.set(value)

/** Follow it for as long as this document lives — the same shape as
 *  {@link ./autopush.ts}'s, started once from `main.tsx`, because a preference
 *  belongs to the browser and a browser is more than one tab. */
export const followAutoCommit = (): void => {
  pref.follow()
}
