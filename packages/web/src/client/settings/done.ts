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

import type { Drawn } from "../page.ts"
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

/**
 * The same question asked of a whole PAGE — and the answer to "which pages does
 * this preference reach", which is here rather than at the composition for the
 * reason above: it is a fact about the preference.
 *
 * It reaches a TREE and nothing else, and that is where it has always reached.
 * A day and the agenda answer a date question and the trash is what was put
 * away; hiding finished work inside any of the three would be this switch
 * deciding something none of those pages was asked — a day page is a record of
 * what happened, and half of what happened is work that got finished.
 *
 * THE SAME VALUE COMES BACK when nothing is hidden, identity and all —
 * `withoutDone` hands back the very array it was given in that case, and this
 * hands back the whole reading rather than rewrapping it. That identity is what
 * `../filter/narrowing.ts`'s count of held-back matches tests, and a fresh
 * wrapper per frame would make it walk the page twice to prove the answer was
 * zero.
 */
export const visibleIn = (drawn: Drawn): Drawn => {
  if (drawn.kind !== "tree") return drawn
  const rows = visible(drawn.rows)
  return rows === drawn.rows ? drawn : { kind: "tree", rows }
}

/** Follow it for as long as this document lives — the same shape as
 *  `followStoredTheme` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. */
export const followDoneHidden = (): void => {
  pref.follow()
}
