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
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md).
 *
 * WHY THE SPLIT IS WORTH A FILE. Every function here is a `switch` over the
 * five shapes a page can be, and each is one line per shape; the reading is
 * five memos and about as many paragraphs of argument. Read together, the
 * shapes-per-question table was invisible — and it is the thing that has to
 * grow an arm the day a sixth page kind draws nodes. The rule, and
 * the reason it is a rule: prefer files and a hierarchy over a module that
 * holds everything about one word.
 *
 * NO SECOND OPINION ABOUT A PRUNE. Where a count is over rows a prune already
 * decided, it counts the PRUNE rather than re-deciding it ({@link matchesIn}'s
 * day and agenda arms) — a walk written here would be free to disagree with
 * the very pruning it is counting, which is the drift `datedIn` was moved down
 * to `@olai/format` to prevent one layer lower.
 *
 * THE SIXTH PAGE DRAWS NO ROWS AT ALL — the graph's places are dots and the
 * links are the lines between them, so its prune is over the VERTICES: the
 * centre stays (the page is about it whether or not it matched), a matched
 * vertex stays, a line stays exactly when both its ends stay. Documents are
 * matched off the same query and arrive on the same wire, but they are not
 * `Selected`'s: `Selected` means "this NODE id matched", so the documents
 * side reads its own map (`@olai/format`'s `MatchedDocument`), and the two
 * halves pass beside one another.
 */

import type { MatchedDocument, Selected, TrashGroup } from "@olai/format"
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
export const narrowed = (
  drawn: Drawn,
  matched: Selected,
  documents: ReadonlyMap<string, MatchedDocument>,
): Drawn => {
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
    case "graph": {
      // The CENTRE stays, matched or not — it is what the page is about; a
      // query that takes it away has not narrowed the page, it has emptied
      // the sentence it answers.
      const centre = drawn.around?.kind === "vertex" ? drawn.around.vertex.key : undefined
      const keep = new Set(
        drawn.vertices.flatMap((vertex) => {
          if (vertex.key === centre) return [vertex.key]
          return (
              vertex.address.kind === "node" ? matched.has(vertex.address.id)
            : documents.has(vertex.address.path)
          ) ? [vertex.key] : []
        }),
      )
      return {
        ...drawn,
        vertices: drawn.vertices.filter((vertex) => keep.has(vertex.key)),
        edges: drawn.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to)),
      }
    }
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
    case "graph":
      return drawn.vertices.length
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
export const matchesIn = (
  drawn: Drawn,
  matched: Selected,
  documents: ReadonlyMap<string, MatchedDocument>,
): number => {
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
    case "graph":
      // Every vertex either matched or did not — the centre is not special
      // here: `narrowed` keeps it regardless, and this counts what the query
      // selected, so a kept-but-unselected centre is exactly as silent as it
      // should be.
      return drawn.vertices.reduce(
        (total, vertex) =>
          total +
          ((
              vertex.address.kind === "node" ? matched.has(vertex.address.id)
            : documents.has(vertex.address.path)
          ) ? 1 : 0),
        0,
      )
    case "none":
      return 0
  }
}
