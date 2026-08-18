/**
 * The query's words, LIT — one text split into what the filter landed on and
 * what it did not.
 *
 * A filtered page draws rows the reader did not ask for by name: the ancestors
 * that lead to a match, and matches whose reason is a word buried in a title or
 * behind the ¶. Highlighting is what turns that page from a list of rows into
 * an answer — "this one, because of THAT" — and it is view-time only: nothing
 * is stored, nothing is re-matched, and clearing the box leaves every title
 * exactly as it was.
 *
 * WHERE the words land is not decided here. `@olai/format`'s `litBy` answers
 * it, over the same `toLowerCase` fold `matching` folded the haystacks with —
 * so a highlight cannot appear in a stretch of text the matcher never looked
 * at, which a fresh `indexOf` with its own case rules is free to do. What is
 * here is only the SHAPE the two drawings need: runs of text, each saying
 * whether it is lit.
 *
 * TWO DRAWINGS, and that is why runs rather than markup. A title reaches the
 * page as an HTML STRING (`../markdown/tags.ts`, over `innerHTML`), and it has
 * two paths that are held byte-for-byte to each other (`../markdown/plain.ts`,
 * `../markdown/title.ts`); a note's excerpt is Solid elements, where the
 * escaping is the framework's. One split, three writers, no second opinion
 * about which characters are the needle.
 */

import type { Lit } from "@olai/format"

/**
 * The class a lit run wears — a `<mark>`, which is the element for exactly
 * this and brings the reading-software half for free.
 *
 * The ink is `../styles.css`'s, beside the tag rules and for their reason: a
 * title is HTML that belongs to no component, so no inline utility can reach
 * it. Unlike a tag, a mark needs no `data-narrowable` guard — a tag is drawn
 * on every page whether or not it can be pressed, where a mark exists only
 * where a query put one.
 */
export const HIT_CLASS = "olai-hit"

/** One stretch of a text, and whether the query landed on it. */
export interface Run {
  readonly text: string
  readonly lit: boolean
}

/**
 * A WINDOW of a text as the runs it turns out to be — never empty, and a single
 * unlit run for a window nothing landed in.
 *
 * The alternation is what a caller draws: unlit runs go out as they came in,
 * and a lit one is wrapped. Empty runs are never emitted, so a hit at the very
 * start of a window is one run and not two.
 *
 * IT TAKES THE LANDINGS rather than the needles, and that is the whole of the
 * shape: there is exactly one search of a title or a note (`@olai/format`'s
 * `litBy`), and every window onto it is a pair of bounds applied to what that
 * search found. Searching each window instead would be a second search — cheap,
 * and wrong twice over: free to disagree at the edge where a needle straddles a
 * cut, and blind to a phrase that spans two of them (`"remodel #home"` is in
 * neither the text part nor the tag part it crosses).
 *
 * The bounds are the TEXT's own offsets, so a caller slices nothing itself.
 */
export const runsIn = (
  text: string,
  landings: ReadonlyArray<Lit>,
  from = 0,
  to = text.length,
): ReadonlyArray<Run> => {
  const runs: Array<Run> = []
  let at = from
  for (const landing of landings) {
    if (landing.end <= from) continue
    if (landing.at >= to) break
    const start = Math.max(landing.at, from)
    const end = Math.min(landing.end, to)
    if (start > at) runs.push({ text: text.slice(at, start), lit: false })
    runs.push({ text: text.slice(start, end), lit: true })
    at = end
  }
  // The tail — and, for a window nothing landed in, the whole of it: a text is
  // always at least one run, so a caller never has an empty list to mean two
  // things by.
  if (at < to || runs.length === 0) runs.push({ text: text.slice(at, to), lit: false })
  return runs
}

/** No needles — one value, shared, because every title memoises against
 *  whatever it is handed and a fresh `[]` per row per frame is a fresh value
 *  every frame. */
export const NO_NEEDLES: ReadonlyArray<string> = []
