/**
 * HOW MANY MORE OF THIS QUERY THE DIRECTORY HOLDS — the number the widen line
 * says, and the truth a narrowed page could not tell on its own.
 *
 * `3 of 41` is honest about the page and silent about everything else. A reader
 * who types `#next` into one outline has no way of knowing the tag is on four
 * more nodes in two other files — which is exactly the complaint that produced
 * this whole change (docs/brainstorming/one-search-box.md). So the bar says the
 * difference, and the words after it are the way through.
 *
 * ## Where the number comes from, and why it is a CALL
 *
 * The wire's own uncapped `total`, off `search.nodes` asked with **no
 * `file`/`under` scope and `limit: 0`** — the whole directory, counted, no rows
 * carried — minus the nodes the page's own narrowing already selected. Never a
 * walk in this browser, which holds no vault to walk
 * (docs/brainstorming/vault-in-browser.md).
 *
 * A PROCEDURE and not a stream, and this is the one trade the design makes
 * deliberately. The page's narrowing is a subscription because it is bounded by
 * the PAGE, so re-reading it on every published revision costs a page-sized
 * walk (docs/brainstorming/filter-rides-the-page.md). This number is bounded by
 * the CORPUS. On the revision pulse it would put a whole-vault match behind
 * every write while any page is filtered — which is the nine-walks-per-bulk-
 * gesture defect that design removed, re-created one line over. So it is asked
 * once per settled keystroke, behind the same 200ms every other box settles on,
 * and it does not move again until the words do. A hint a few seconds old is
 * honest; a regression is not.
 *
 * ## The subtraction, exactly
 *
 * NODES, not places. The page's answer is keyed by node id, so its `size` is
 * how many distinct nodes on this page the query selected — where the ROWS
 * could count one node twice, once at a mirror of it, and the difference would
 * be an "elsewhere" that shrank when somebody placed a mirror.
 *
 * CLAMPED AT ZERO, and it is not defensive: the trash page's narrowing can
 * select archived nodes that a directory-wide search leaves out unless the
 * query says `is:trashed` (docs/search.md), so the two counts are honestly
 * about slightly different sets there. A negative number is not news; no line
 * is.
 *
 * DOCUMENTS COUNT AS ELSEWHERE, and that falls out rather than being decided
 * here: `total` counts both kinds, a document is never a row of a page filter,
 * so every matched document survives the subtraction. Which is right — a `.md`
 * whose prose holds the word is precisely a thing the page in front of you
 * cannot show you.
 */

import { type Accessor, createMemo } from "solid-js"

import type { Filter } from "@olai/format"

import { createSettled } from "../settled.ts"
import { olai } from "../wire.ts"
import type { Matches } from "./matches.ts"

/**
 * How many hits the counting ask carries back: none. The number is the
 * ANSWER's `total`, which is uncapped and travels beside the hits precisely so
 * that a door can say what it left out (`@olai/format`'s `SearchAnswer`) — so
 * this door asks for the sentence and pays for no rows at all.
 */
const COUNT_ONLY = 0

/**
 * HOW MANY MORE — `null` while nothing has answered.
 *
 * ONE ACCESSOR and not a record holding one, which is the shape the consumer
 * asked for: `elsewhere.more()` is a double-deref for a reading with a single
 * fact in it, and a record is what a reading grows into when it has several
 * (`./asking.ts` has five, and each of them earns its name).
 */
export const createElsewhere = (source: {
  /** What the grammar made of the box, parsed once by the pane — so an empty
   *  box and a query the grammar refused cost nothing at all, exactly as they
   *  cost the narrowing nothing (`./asking.ts`). */
  readonly query: Accessor<Filter>
  /** …and the words themselves, which are what goes on the wire. */
  readonly text: Accessor<string>
  /**
   * WHETHER THERE IS ANYWHERE WIDER TO GO — false on `/search`, which IS
   * everywhere, and false on a page that takes no filter.
   *
   * Handed in rather than read off a route here, because which pages are
   * narrowable is `../routes.ts`'s one answer and the pane already holds it.
   */
  readonly widenable: Accessor<boolean>
  /** What the page's own narrowing selected — `undefined` before it has said
   *  anything. The subtrahend, and the reason this waits for it: a difference
   *  taken against nothing would be the whole directory's count wearing the
   *  word "more". */
  readonly onPage: Accessor<Matches | undefined>
}): Accessor<number | null> => {
  const asked = createSettled(
    () => {
      if (!source.widenable() || source.query().kind !== "asking") return null
      const words = source.text().trim()
      return words === "" ? null : words
    },
    (text) => olai.procedures.search.nodes({ text, limit: COUNT_ONLY }),
  )

  return createMemo(() => {
    // WHILE THE ANSWER IS ABOUT SOMETHING ELSE, say nothing. `answering` is
    // `null` through the settle and the flight of a newer question, and a
    // difference between the last query's total and this query's page is
    // arithmetic across two moments — the very thing `./count.ts` exists to
    // refuse.
    if (asked.answering() === null) return null
    const total = asked.answer()?.total
    const here = source.onPage()
    if (total === undefined || here === undefined) return null
    return Math.max(0, total - here.size)
  })
}
