/**
 * The four questions a filter asks of a DRAWN PAGE — one arm per shape, and
 * nothing in here knows a query, a preference or a signal.
 *
 * Split out of `./narrowing.ts` because they are two different kinds of thing
 * that were braided into one file. That one is a READING: a memo graph over
 * what the reader typed, what the store published and what the clock says —
 * time. This one is arithmetic over a value: given a page and a set of ids,
 * which rows survive, how many places there are, how many of them the query
 * selected, and whether anything on it was put away. Pure, total over
 * `../page.ts`'s {@link Drawn}, and testable by handing it a page.
 *
 * WHY THE SPLIT IS WORTH A FILE. Every function here is a `switch` over the
 * shapes a page can be, and each is one line per shape; the reading is
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

import type { Selected } from "@olai/format"
import {
  datedIn,
  isArchived,
  keeping,
  keepingDated,
  keepingGraph,
  keepingOwed,
  matchedIn,
  matchedInGraph,
  owedIn,
  placesInGraph,
  rowsIn,
  shownRecord,
} from "@olai/format"

import type { Drawn, TrashGroup } from "../page.ts"

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
    // THE CENTRE STAYS, whether or not it matched, and the arrows a prune
    // orphaned go with the nodes they pointed at (`@olai/format`'s
    // `keepingGraph`). It is the day page's rule read on a shape: a day
    // narrowed to nothing is still that day, and a neighbourhood narrowed to
    // nothing is still that node's — with the answer being that nothing around
    // it matches, which is a thing worth being able to see.
    case "graph":
      return { ...drawn, graph: keepingGraph(drawn.graph, matched, drawn.focus) }
    case "none":
      return drawn
  }
}

/**
 * Is the page in front of the reader drawing anything that was PUT AWAY?
 *
 * TWO PAGES CAN BE, and after the 2026-08-17 ruling that is the whole list. The
 * TRASH is the archive, every group of it — so the answer is its kind and not a
 * scan, because a trash drawing no archived row is a trash drawing no row. And
 * a TREE can be one node's: `/n/<id>` on a node somebody put away, which is
 * exactly where an `is:archived` hit lands when it is clicked (docs/search.md —
 * the ruling took away the default presence, not the reachability). An
 * outline's own tree is a live file, since an archive's address opens the trash
 * instead (`../page.ts`) — with one gap that is not this file's to close: a
 * MIRROR still resolves to a node that was archived after it was placed
 * (`@olai/format`'s `follow`, which the ops layer keeps resolving on purpose),
 * so a placement can draw an archived row on a live page. What that row should
 * be is a ruling about the SET rather than about a filter, and it is filed as
 * one (docs/search.md, docs/brainstorming/editing-web.md's Open).
 *
 * A DAY AND THE AGENDA ANSWER NO, and they answer it by construction rather
 * than by a rule kept here: the walk those pages are built from leaves archived
 * nodes out (`@olai/format`'s `dates.ts`), so there is nothing on either of
 * them for this to find. Left as arms of the switch rather than folded into a
 * default, because a page kind that starts drawing archived rows should have to
 * come back here and say so.
 *
 * The tree arm reads the ROOTS, never a walk: a row shows a record that names a
 * file, and a zoom is inside one file the whole way down. That is the honest
 * bound — this runs per keystroke, and what it feeds is a default rather than a
 * permission.
 *
 * WHAT IT DECIDES IS THE CANDIDATE SET, AND THE COST IS WHOLE-ARCHIVE, which is
 * worth stating rather than leaving to be discovered. `true` puts every
 * archived node in the directory in front of the matcher — not only the ones
 * this page could draw — and the rows that match somewhere else are then
 * dropped by the prune. That is not a leak in this reading, it is how the door
 * already works for every other node: it matches over the SET and narrows by
 * the PAGE ({@link narrowed}), which is what lets a mirror of a node in another
 * file stay drawn where it is placed. What asking buys is the pages that draw
 * NONE — every outline, which is the page somebody types on all day — paying
 * nothing for a file that only ever grows.
 */
export const showsArchived = (drawn: Drawn): boolean => {
  switch (drawn.kind) {
    case "trash":
      return true
    case "tree":
      return drawn.rows.some((row) => isArchived(shownRecord(row).file))
    case "day":
    case "agenda":
    // A GRAPH answers no by construction, the way a day does: the walk it is
    // built from never steps into an archive and refuses an archived centre
    // (`@olai/format`'s `graphOf`), so there is nothing on it for this to find.
    case "graph":
    case "none":
      return false
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
    // A node is drawn once on a graph — there is no placement to draw a second
    // dot for — so the two numbers are over the same walk the format defines.
    case "graph":
      return placesInGraph(drawn.graph)
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
    // The CENTRE is counted like any other node: it is a match when the query
    // selected it and context when the query merely kept it, which is the same
    // distinction a kept ancestor draws on a tree.
    case "graph":
      return matchedInGraph(drawn.graph, matched)
    case "none":
      return 0
  }
}
