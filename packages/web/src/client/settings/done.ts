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
import { withoutDone, withoutDoneGraph } from "@olai/format"
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
 * IT REACHES A TREE AND A GRAPH, and the second one is the preference doing
 * what it always said it did. "I do not want to look at finished work" is a
 * claim about the READER, so it applies to every page that draws what the
 * directory says NOW. A day, the agenda and the trash are the pages it still
 * does not reach, and for the reason it never did: those are RECORDS — a day is
 * what happened, and half of what happened is work that got finished, so hiding
 * it there would be this switch answering a question the page was not asked. A
 * graph is not a record of anything, which is why it joins the tree rather than
 * them (`@olai/format`'s `withoutDoneGraph`, and the human asked for it from a
 * corpus graph that was mostly struck-through dots).
 *
 * The CENTRE of a graph stays whether or not it is finished: the page is about
 * that node, and a reader who opens a done node's own graph is asking about it.
 *
 * THE SAME VALUE COMES BACK for a reader who is not hiding anything, identity

 * and all: {@link visible} hands back the very array it was given when the
 * preference is off, and this hands back the whole reading rather than
 * rewrapping it. That identity is what `../filter/narrowing.ts`'s count of
 * held-back matches reads as its zero, and a fresh wrapper per frame would make
 * it walk the page twice to prove the answer was nothing.
 *
 * ANYTHING ELSE SUBTRACTED HERE HAS TO GO AND SAY SO, and this is the sentence
 * that says which file: the filter's count line reports the matches this
 * function took away as "hidden as done" (`../filter/count.ts`), and it arrives
 * at that number as the difference between the page and what comes back from
 * here. What the label claims is exactly what this function does, and no more:
 * these rows are the ones THIS PREFERENCE took off — a finished row, and the
 * subtree that goes with it, which is why a match beneath a done ancestor is
 * counted here and is honestly blamed on the switch that swept it away (the
 * menu refuses to tick off a branch still holding unfinished TASKS, which is
 * where that rule is kept). A second reason to drop a row, added here, would
 * quietly be reported under this one's name — so it belongs there as its own
 * clause, not inside this subtraction.
 *
 * IT IS THE PREFERENCE AND NOT THE ROWS that the identity is about, which is
 * worth being exact on: `withoutDone` is a `flatMap` and mints a new list
 * whichever way it goes, so a reader who IS hiding finished work gets a fresh
 * value even on a page where nothing is finished — and the count downstream
 * then does the honest subtraction instead of short-circuiting. The check
 * below still earns its place: it is the default reading, and it is every page
 * this preference does not reach.
 */
export const visibleIn = (drawn: Drawn): Drawn => {
  if (!doneHidden()) return drawn
  if (drawn.kind === "tree") {
    const rows = withoutDone(drawn.rows)
    return rows === drawn.rows ? drawn : { kind: "tree", rows }
  }
  if (drawn.kind === "graph") {
    const graph = withoutDoneGraph(drawn.graph, drawn.focus)
    return graph === drawn.graph ? drawn : { ...drawn, graph }
  }
  return drawn
}

/** Follow it for as long as this document lives — the same shape as
 *  `followStoredTheme` and `followLayout`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab. */
export const followDoneHidden = (): void => {
  pref.follow()
}
