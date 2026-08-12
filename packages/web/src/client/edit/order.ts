/**
 * The rows as a reader's eye runs down them.
 *
 * The tree is nested and the arrow keys are not: `↓` from the last child of a
 * branch lands on whatever is drawn next, wherever that is in the shape. So
 * something has to flatten the drawn tree, and it has to flatten exactly what
 * is DRAWN — a folded branch's children are not on screen, so `↓` may not stop
 * in them, and rows hidden by done-visibility are already gone from the list
 * this walks (the page's memo filters them before anything here sees them).
 *
 * Pure over rows and a fold set, so the one thing worth getting wrong — where
 * `↓` goes from the last child of a collapsed parent — is a unit test rather
 * than a thing to try in a browser.
 */

import type { Row } from "@olai/format"

/** Every row on screen, in the order they are painted.
 *
 *  One array, filled as the walk goes. The `flatMap` this replaced allocated a
 *  fresh array per row and spread each child result into its parent's, which
 *  is O(rows × depth) copies for an answer that is a list — and this runs
 *  whenever the caret moves through a tree that can be thousands of rows. */
export const flatten = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
): ReadonlyArray<Row> => {
  const drawn: Array<Row> = []
  const walk = (level: ReadonlyArray<Row>): void => {
    for (const row of level) {
      drawn.push(row)
      if (!collapsed.has(row.key)) walk(row.children)
    }
  }
  walk(rows)
  return drawn
}

/** The row before or after this place, or `undefined` at either end of the
 *  page — where the caret simply stays put, because there is nowhere to go and
 *  a wrap-around would be a surprise rather than a convenience. */
export const neighbour = (
  rows: ReadonlyArray<Row>,
  collapsed: ReadonlySet<string>,
  place: string,
  step: 1 | -1,
): Row | undefined => {
  const drawn = flatten(rows, collapsed)
  const at = drawn.findIndex((row) => row.key === place)
  return at === -1 ? undefined : drawn[at + step]
}
