/**
 * The three questions a filter asks of a DRAWN PAGE — one arm per shape, and
 * nothing in here knows a query, a preference or a signal.
 *
 * Split out of `./narrowing.ts` because they are two different kinds of thing
 * that were braided into one file. That one is a READING: a memo graph over
 * what the reader typed, what the store published and what the clock says —
 * time. This one is arithmetic over a value: given a page and a set of ids,
 * which rows survive, how many places there are, and how many of them the query
 * selected. Pure, total over `../page.ts`'s {@link Drawn}, and testable by
 * handing it a page.
 *
 * THE FOURTH QUESTION WAS THE ARCHIVE'S — whether the rows in front of somebody
 * are put-away ones, which the matcher had to be TOLD because only the caller
 * knew. It is the server's now (`@olai/format`'s `showsPutAway`), asked of the
 * page it is already computing: the browser stopped describing its page to the
 * matcher the day it started naming it instead
 * (docs/brainstorming/filter-rides-the-page.md).
 *
 * WHY THE SPLIT IS WORTH A FILE. Every function here is a `switch` over the
 * five shapes a page can be, and each is one line per shape; the reading is
 * five memos and about as many paragraphs of argument. Read together, the
 * shapes-per-question table was invisible — and it is the thing that has to
 * grow an arm the day a sixth page kind draws nodes. HACKING.md's rule, and
 * the reason it is a rule: prefer files and a hierarchy over a module that
 * holds everything about one word.
 *
 * NO SECOND OPINION ABOUT A PRUNE. Where a count is over rows a prune already
 * decided, it counts the PRUNE rather than re-deciding it ({@link matchesIn}'s
 * day and agenda arms) — a walk written here would be free to disagree with
 * the very pruning it is counting, which is the drift `datedIn` was moved down
 * to `@olai/format` to prevent one layer lower.
 */

import type { Selected, TrashGroup } from "@olai/format"
import {
  datedIn,
  keeping,
  keepingDated,
  keepingOwed,
  matchedIn,
  owedIn,
  rowsIn,
} from "@olai/format"

import type { Drawn } from "../page.ts"

/**
 * The same page with everything that did not match taken out of it — one arm
 * per shape, and each arm is the format's own prune rather than a rule invented
 * here (`keeping`, `keepingDated`, `keepingOwed`).
 *
 * The trash is the one composition: an archive is a tree, so its rows are
 * `keeping`'s, and an archive left with nothing goes the way a day's group does
 * — a heading over no rows would say that archive holds something the query
 * did not find.
 */
export const narrowed = (drawn: Drawn, matched: Selected): Drawn => {
  switch (drawn.kind) {
    case "tree":
      return { kind: "tree", rows: keeping(drawn.rows, matched) }
    // THE NOTE GOES WITH THE ROWS THAT DID NOT MATCH, and it is decided here
    // rather than in the page for the reason everything else about a narrowed
    // page is: a note is a DOCUMENT — prose, which is exactly the page kind
    // that takes no filter (`../routes.ts`) — so it can never be a match, and
    // a day answering a query with somebody's prose plus no rows would be
    // answering something nobody asked.
    case "day":
      return { kind: "day", groups: keepingDated(drawn.groups, matched), notes: [] }
    case "agenda":
      return { kind: "agenda", agenda: keepingOwed(drawn.agenda, matched) }
    case "trash":
      return { ...drawn, groups: keepingArchives(drawn.groups, matched) }
    // NOTHING LEFT TO TAKE AWAY, for two quite different reasons that land on
    // one line. `none` is a page with no rows to narrow; `/search` IS the query
    // — its rows are what the matcher already kept, ancestry and all
    // (`@olai/format`'s `everywhere.ts`), so a prune would be the same answer
    // applied to itself. The narrowing beside it is not wasted there: it is what
    // LIGHTS the rows and dims the ancestry, which is a question about why a row
    // is drawn rather than about whether it is.
    case "search":
    case "none":
      return drawn
  }
}

const keepingArchives = (
  groups: ReadonlyArray<TrashGroup>,
  matched: Selected,
): ReadonlyArray<TrashGroup> =>
  groups.flatMap((group) => {
    const rows = keeping(group.rows, matched)
    return rows.length === 0 ? [] : [{ ...group, rows }]
  })

/** How many PLACES a page is made of — asked of what it HOLDS, which is the
 *  second number in "3 of 41" (`./count.ts`'s `Counts.held`). */
export const placesIn = (drawn: Drawn): number => {
  switch (drawn.kind) {
    case "tree":
      return rowsIn(drawn.rows)
    case "day":
      return datedIn(drawn.groups)
    case "agenda":
      return owedIn(drawn.agenda)
    case "trash":
      return drawn.groups.reduce((total, group) => total + rowsIn(group.rows), 0)
    // THE EVERYWHERE PAGE COUNTS ITSELF, in a different sentence about a
    // different subject: "12 matches in 3 files", off its own reading
    // (`../search/said.ts`). There is no page underneath it for "3 of 41" to be
    // about, so the three numbers this feeds are not asked of it — and
    // answering `0` here is what keeps them from being walked for nobody.
    case "search":
    case "none":
      return 0
  }
}

/**
 * How many of those places the query SELECTED — the first number.
 *
 * Asked of the pruned page it is the count of what is on screen, and asked of
 * the unpruned one it is what the done preference held back; the membership
 * test is what lets one function answer both. On a tree the two numbers differ
 * for a third reason — a kept ancestor is drawn and is not a match — which is
 * the distinction the whole feature is made of.
 */
export const matchesIn = (drawn: Drawn, matched: Selected): number => {
  switch (drawn.kind) {
    case "tree":
      return matchedIn(drawn.rows, matched)
    // The prune, counted — never a second reading of which rows a set of ids
    // selects. A count written here would be free to disagree with the very
    // pruning it is counting, which is the drift `datedIn` was moved down to
    // `@olai/format` to prevent one layer lower.
    case "day":
      return datedIn(keepingDated(drawn.groups, matched))
    case "agenda":
      return owedIn(keepingOwed(drawn.agenda, matched))
    case "trash":
      return drawn.groups.reduce(
        (total, group) => total + matchedIn(group.rows, matched),
        0,
      )
    // …and its numerator, for {@link placesIn}'s reason.
    case "search":
    case "none":
      return 0
  }
}
