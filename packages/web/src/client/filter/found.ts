/**
 * WHAT THE BAR SAYS ABOUT THIS ANSWER — one reading, at either of the box's two
 * scopes.
 *
 * ## Why it is one thing
 *
 * The bar's sentence is assembled from three quite different sources: the
 * page's own three numbers (`./narrowing.ts`), the count of what the same query
 * matches ELSEWHERE (`./elsewhere.ts`, a call rather than a subscription), and
 * the everywhere page's own reading of itself (`../search/said.ts`). Held apart
 * they were three bindings in the pane, and the pane had to know which of them
 * to read for which page — which is the fragmentation `hickey`'s second layer
 * names: one domain concept ("what this bar has to say") split across three
 * places, held together by a rule written nowhere.
 *
 * Held together they are one axis of change, which is `lowy`'s question:
 * the day the bar says a fourth thing — a scope toggle, a saved-search hint,
 * a second number — it changes HERE and the pane does not hear about it. What
 * the pane keeps is the two facts only it has: which page is open, and what its
 * narrowing found.
 *
 * ## What it is NOT
 *
 * The GESTURE. Widening is a navigation, so it belongs where navigations
 * happen; this decides only whether there is anything to say about one. The two
 * are handed to the bar separately for that reason (`./FilterBar.tsx`'s
 * `onWiden`), and the bar reads WHICH SCOPE it is at off {@link Found} — the
 * one value that says so — rather than off the absence of a callback.
 */

import { type Accessor, createMemo } from "solid-js"

import type { Filter } from "@olai/format"

import { only } from "../narrow.ts"
import type { Drawn } from "../page.ts"
import { everywhereLine } from "../search/said.ts"
import type { Counts, Found } from "./count.ts"
import { createElsewhere } from "./elsewhere.ts"
import type { Matches } from "./matches.ts"

export const createFound = (source: {
  /** What the grammar made of the box, parsed once by the pane. */
  readonly query: Accessor<Filter>
  /** …and the words themselves. */
  readonly text: Accessor<string>
  /** Whether this page takes a filter at all (`../routes.ts`'s `narrowable`) —
   *  handed in because which pages do is that module's one answer. */
  readonly narrowable: Accessor<boolean>
  /** What the page DRAWS, which is where the everywhere page's own numbers
   *  are: the count it says instead of "3 of 41" is a fact about the reading
   *  rather than about the query. */
  readonly drawn: Accessor<Drawn>
  /** The page's own three numbers, for every other page. */
  readonly counts: Accessor<Counts>
  /** What this page's narrowing selected — the subtrahend the elsewhere count
   *  is taken against. */
  readonly matched: Accessor<Matches | undefined>
}): Accessor<Found> => {
  /** IS THERE ANYWHERE WIDER TO GO? False on `/search`, which IS everywhere,
   *  and false on a page that takes no filter, which has no box. Read off the
   *  page's own reading rather than off a route, so it and the sentence below
   *  cannot disagree about which page this is. */
  const widenable = () => source.narrowable() && only(source.drawn(), "search") === undefined

  const elsewhere = createElsewhere({
    query: source.query,
    text: source.text,
    widenable,
    onPage: source.matched,
  })

  return createMemo((): Found => {
    const everywhere = only(source.drawn(), "search")
    return everywhere === undefined
      ? { kind: "page", counts: source.counts(), elsewhere: elsewhere() }
      : { kind: "everywhere", said: everywhereLine(everywhere) }
  })
}
