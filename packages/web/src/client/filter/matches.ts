/**
 * WHAT A QUERY SELECTED — the value a row looks itself up in.
 *
 * Split out of `./asking.ts` for the reason `./drawn.ts` was: that file is a
 * READING — a debounce, a subscription, a wire member it reaches at import time
 * — and this is the shape those things carry. One name, in one place, so the
 * reading, the prune and the four questions a row asks (`./why.ts`) are all
 * spelled against the same type.
 *
 * IT USED TO HOLD A PREDICATE as well — whether two answers said the same
 * thing, so a page re-asked on every frame did not prune itself again for a
 * match set that had not moved (`docs/brainstorming/reactivity-after-the-flip.md`
 * §3.5). There is no such frame any more: the narrowing is a reading the server
 * re-takes on the revision pulse and sends only when it changed by value, so an
 * answer that did not move never arrives, this map is never rebuilt, and the
 * comparison happens once on the side that can act on it
 * (`docs/brainstorming/filter-rides-the-page.md`).
 */

import type { MatchedNode } from "@olai/surface"

/** What a query selected, ready for a row to look itself up in: id → why. The
 *  server's own answer rows, kept as they arrived rather than re-shaped — the
 *  `matched` field is what `./why.ts` reads to draw a note excerpt, and a
 *  second shape here would be a second reading of it. */
export type Matches = ReadonlyMap<string, MatchedNode>
