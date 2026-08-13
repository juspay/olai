/**
 * Whether this browser draws finished work.
 *
 * A claim about the READER rather than about any one page — "I do not want to
 * look at finished work" — so it lives here, with the other preferences, and
 * not as a switch on the outline. Hiding a row writes nothing: the node stays
 * marked, the file stays put, and this reading simply does not draw it.
 *
 * The circuit is `../preference.ts`. Cross-tab follow is the same `storage`
 * event the theme and the folds ride, started once from `main.tsx`.
 */

import type { Row } from "@olai/format"
import { withoutDone } from "@olai/format"
import type { Accessor } from "solid-js"

import { boolCodec, createPreference } from "../preference.ts"

export const DONE_HIDDEN_KEY = "olai.done.hidden"

/** Shown, for a browser that has never been asked — and for a value nothing
 *  here ever wrote, which is `boolCodec`'s rule and not this file's. */
const SHOWN = false

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(DONE_HIDDEN_KEY, boolCodec(SHOWN))

/** Whether this browser hides what is done. */
export const doneHidden: Accessor<boolean> = pref.value

/** Persist on change — `pref.set` writes `olai.done.hidden`. The write is
 *  fenced by `preferences.feature`'s stored-key step (on master before this
 *  PR). The reload scenario fences the boot read, not this setter. */
export const setDoneHidden = (value: boolean): void => pref.set(value)

/** The rows this reading actually draws. The preference and what it does to a
 *  tree are one thing, so every page asks the same question rather than each
 *  re-deciding what "hidden" means. */
export const visible = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  doneHidden() ? withoutDone(rows) : rows

/** Follow it for as long as this document lives — the same shape as
 *  `followStoredTheme` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. */
export const followDoneHidden = (): void => {
  pref.follow()
}
