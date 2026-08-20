/**
 * WHAT A QUERY SELECTED — the value, and when two of them say the same thing.
 *
 * Split out of `./asking.ts` for the reason `./drawn.ts` was: that file is a
 * READING — a debounce, a resource, a staleness rule, and a wire member it
 * reaches at import time — and this is arithmetic over a value. Nothing here
 * knows a signal or a socket, which is what lets the predicate below be a unit
 * test rather than a browser one.
 */

import type { MatchedNode } from "@olai/surface"

import { sameMap } from "../same.ts"

/** What a query selected, ready for a row to look itself up in: id → why. The
 *  server's own answer rows, kept as they arrived rather than re-shaped — the
 *  `matched` field is what `./why.ts` reads to draw a note excerpt, and a
 *  second shape here would be a second reading of it. */
export type Matches = ReadonlyMap<string, MatchedNode>

/**
 * Whether two answers select the same nodes for the same reasons.
 *
 * A PAGE IS RE-ASKED WHENEVER ITS SET MOVES (`./asking.ts`'s `Ask.at`), and
 * most of those answers are the answer that was already on screen: a row
 * retitled two folders away moves this page's set and selects exactly what it
 * selected before. The matcher's answer is a fresh `Map` of fresh rows every
 * time, so without this every one of them walked the page again —
 * `./narrowing.ts`'s `selected` → `drawn` re-runs `narrowed()` over the whole
 * tree, a second full prune for an answer that changed nothing
 * (docs/brainstorming/reactivity-after-the-flip.md §3.5).
 *
 * BY VALUE, and the value is both fields: the id is what a row looks itself up
 * by, and `matched` is which field the query was found in, which is what
 * `./why.ts` draws its excerpt from. Walked one way round only, because the
 * sizes are checked first — so `is` can hold no id `was` does not.
 *
 * `undefined` is "nothing has been answered yet" and is NOT the empty map
 * (`./asking.ts`'s `Asked.matched` argues why that distinction is
 * load-bearing), so it compares equal only to itself.
 */
export const sameMatches = (
  was: Matches | undefined,
  is: Matches | undefined,
): boolean =>
  was === is ||
  (was !== undefined && is !== undefined &&
    sameMap(was, is, (one, other) => one.matched === other.matched))
