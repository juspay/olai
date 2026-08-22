/**
 * HOW MUCH OF THIS QUERY THE PAGE IS NOT SHOWING — the widen line's number, and
 * the one thing on the bar that is not about the page in front of somebody.
 *
 * `3 of 41` is honest about the page and silent about everything else. A reader
 * who types `#next` into one outline has no way of knowing the tag is on four
 * more nodes somewhere else — which is exactly the complaint that produced this
 * whole change (docs/brainstorming/one-search-box.md). So the bar says the
 * difference, and the words after it are the way through.
 *
 * ## The number is the SERVER's, and that is a correction
 *
 * This file used to compute it: `search.nodes` with no scope for a directory
 * total, minus the size of this page's own narrowing. That is
 * `|directory| − |page|`, which is the complement only where the page's matches
 * are a subset of the directory's — and the reviewers of #334 constructed three
 * pages where they are not. The trash is the sharp one: its rows are ARCHIVED
 * nodes, which a directory-wide search leaves out unless the query says
 * `is:trashed`, so the two sets are disjoint and the subtraction took live
 * matches away for archived ones until the clamp at zero hid the line
 * altogether.
 *
 * A browser cannot fix that, because it cannot see the intersection. So the
 * question is asked where both sets are (`@olai/format`'s `elsewhere.ts`), and
 * what comes back is the complement itself: every node and document the query
 * selects that this page does not draw. True on a zoom, on a day, on the
 * agenda, on the trash.
 *
 * ## What is unchanged
 *
 * A PROCEDURE and not a stream, and it is the one trade the design makes
 * deliberately. The page's narrowing is a subscription because it is bounded by
 * the PAGE, so re-reading it on every published revision costs a page-sized
 * walk (docs/brainstorming/filter-rides-the-page.md). This is bounded by the
 * CORPUS. On the revision pulse it would put a whole-vault match behind every
 * write while any page is filtered — which is the nine-walks-per-bulk-gesture
 * defect that design removed, re-created one file over. So it is asked once per
 * settled keystroke, behind the same 200ms every other box settles on, and it
 * does not move again until the words do. A hint a few seconds old is honest; a
 * regression is not.
 */

import { type Accessor, createMemo } from "solid-js"

import type { Filter, PageRequest } from "@olai/format"
import { sameElsewhereRequest } from "@olai/format"

import { createSettled } from "../settled.ts"
import { olai } from "../wire.ts"

/**
 * WHAT THE BAR KNOWS about the rest of the directory — three states, as a sum.
 *
 * A SUM rather than a nullable number, because the three are three different
 * sentences and one of them used to be silent: a failed call, "nothing has
 * answered yet" and "there is nothing more" all collapsed to `null`, so a
 * `search.elsewhere` that fell over simply hid the door — which is the silent
 * failure HACKING.md's error rule is about (both reviewers of #334 raised it).
 */
export type Elsewhere =
  /** Nothing has answered — the settle, the flight, or a query the grammar
   *  refused and has already spoken for. */
  | { readonly kind: "unknown" }
  /** …and the answer, which may be none. */
  | { readonly kind: "more"; readonly many: number }
  /** The reading could not be taken, in the server's own words. */
  | { readonly kind: "failed"; readonly because: string }

/** Nothing known — ONE value, shared, because an unfiltered pane produces it on
 *  every revision the store publishes and a fresh record per frame is a fresh
 *  value for whatever memoises against it. */
const UNKNOWN: Elsewhere = { kind: "unknown" }

export const createElsewhere = (source: {
  /** What the grammar made of the box, parsed once by the pane — so an empty
   *  box and a query the grammar refused cost nothing at all, exactly as they
   *  cost the narrowing nothing (`./asking.ts`). */
  readonly query: Accessor<Filter>
  /** …and the words themselves, which are what goes on the wire. */
  readonly text: Accessor<string>
  /**
   * WHICH PAGE this is the complement OF — the pane's own request, the same
   * value its rows are asked with.
   *
   * It is what makes the number true rather than nearly true: the server reads
   * that page, asks the corpus the same question under the page's own archive
   * rule, and counts what the page does not draw. `null` asks nothing, which is
   * a pane with no page yet.
   */
  readonly page: Accessor<PageRequest | null>
  /**
   * WHETHER THERE IS ANYWHERE WIDER TO GO — false on `/search`, which IS
   * everywhere, and false on a page that takes no filter.
   *
   * Handed in rather than read off a route here, because which pages are
   * narrowable is `../routes.ts`'s one answer and the pane already holds it.
   */
  readonly widenable: Accessor<boolean>
}): Accessor<Elsewhere> => {
  const asked = createSettled(
    // WHAT IS WORTH A TRIP: a query the grammar READ, on a page there is
    // somewhere wider than. An empty box and a refused query are both `asking`'s
    // absence (`@olai/format`'s `parseFilter` answers `nothing` for a box that
    // read no token at all), so this asks the parse rather than testing the
    // text a second time — one empty-box rule, in the one place that owns it.
    () => {
      const page = source.page()
      if (page === null || !source.widenable() || source.query().kind !== "asking") {
        return null
      }
      return { page, text: source.text().trim() }
    },
    (request) => olai.procedures.search.elsewhere(request),
    // BY VALUE, for `./asking.ts`'s reason: a pane mints a fresh `PageRequest`
    // on every revision the store publishes, and a question compared by
    // reference would be a fresh round trip for an answer already on screen.
    (was, is) =>
      was === is ||
      (was !== null && is !== null && sameElsewhereRequest(was, is)),
  )

  return createMemo<Elsewhere>(() => {
    // A FAILURE FIRST, because it is the one state that must not read as an
    // answer: the door is still drawn, and it says it could not count rather
    // than saying there is nothing more (`./count.ts`'s `widenSaid`).
    const failed = asked.failure()
    if (failed !== null) return { kind: "failed", because: failed }
    // WHILE THE ANSWER IS ABOUT SOMETHING ELSE, say nothing. `answering` is
    // `null` through the settle and the flight of a newer question, and a
    // number about the query before is a claim about a question nobody asked —
    // the very thing `./count.ts` exists to refuse.
    if (asked.answering() === null) return UNKNOWN
    const answer = asked.answer()
    return answer === undefined ? UNKNOWN : { kind: "more", many: answer.more }
  })
}
