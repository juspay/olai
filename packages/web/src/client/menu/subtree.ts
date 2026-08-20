/**
 * WHAT A SUBTREE READS AS — the plain text the `•••` menu's Copy verb puts on
 * the clipboard.
 *
 * It is asked of the ROWS — the tree the format expanded for this page, mirrors
 * resolved, order settled — because what a person copies is what a person can
 * see.
 *
 * ITS SIBLING QUESTION IS ASKED SOMEWHERE ELSE, and the split is worth keeping
 * written down. How MUCH hangs under a row — the number the archive's confirm
 * names — is about the WRITE, so it is asked of the SET, and the rows a page
 * hands the tree are a reading: with done hidden, `withoutDone` has already
 * dropped every finished branch from them (`settings/done.ts`), so a count
 * taken from the rows would say "and the 3 rows under it" over a branch of nine
 * and archive all nine. That count used to live here, walking the browser's own
 * copy of the directory; it rides on the row now (`@olai/format`'s
 * `Row.under`), counted where the set is
 * (`docs/brainstorming/vault-in-browser.md`). The rule did not move — the set
 * did — and the sentence above is why the two answers may never be the same
 * walk.
 *
 * Pure over the rows, so the thing most easily got wrong — an indent that does
 * not survive a paste — is a unit test rather than a browser gesture nobody
 * repeats.
 */

import type { Row } from "@olai/format"

/** One level of indent. A TAB, which is what every outliner reads back as a
 *  level — Workflowy's plain-text export, and what a paste-in parser will look
 *  for the day olai grows one. Spaces would be a guess about how many. */
const INDENT = "\t"

/**
 * A subtree as plain text: one line per node, a tab per level, notes beneath.
 *
 * The human's ruling (2026-08-12), and it is a copy rather than an export —
 * what lands on the clipboard is what a person would have typed:
 *
 *   - the TITLE, verbatim. Not the rendering: a title stores `**walnut**` and
 *     that is the text, so a copy that pasted `walnut` would have thrown away
 *     the only thing that was written down;
 *   - the NOTE under its node, one level deeper, one output line per line of
 *     it — a note is a verbatim markdown string and its own line breaks are
 *     part of it. A blank line inside one stays blank rather than becoming a
 *     line of trailing tabs;
 *   - NO marks, dates or tags. `done` is a timestamp and `#home` is already in
 *     the title; a copy that encoded the first would be inventing a syntax
 *     nothing else in olai reads, and re-encoding the second would double it.
 *
 * A MIRROR is copied as what it draws — its target's title, its target's
 * children — because that is what the reader is looking at and a copy that
 * silently stopped at a placement would lose a branch without saying so. A row
 * drawing no node at all (a mirror whose chain died, one that closed a loop)
 * contributes nothing: it has no title to copy, and the tree beside it already
 * says in words what is wrong with it.
 *
 * FOLDS ARE NOT CONSULTED and hidden-done is, which is not a contradiction:
 * both follow from copying the rows as given. A collapsed branch is a triangle
 * in one reader's tab rather than a fact about the outline, so the whole
 * subtree goes; a done-hidden branch is not among these rows at all, so what
 * comes out is what the page says. Copy what you can see, and everything under
 * it.
 */
export const asText = (row: Row): string => {
  // One array, filled as the walk goes — `edit/order.ts`'s shape, for the
  // reason it gives: a `flatMap` allocates a fresh array per row and spreads
  // each child's result into its parent's, which is O(rows × depth) copies for
  // an answer that is a list.
  const out: Array<string> = []
  write(row, 0, out)
  return out.join("\n")
}

const write = (row: Row, depth: number, out: Array<string>): void => {
  if (row.kind !== "node" && row.kind !== "mirror") return
  const pad = INDENT.repeat(depth)
  out.push(`${pad}${row.shows.node.title}`)
  for (const line of row.shows.node.desc?.split("\n") ?? []) {
    out.push(line === "" ? "" : `${pad}${INDENT}${line}`)
  }
  for (const child of row.children) write(child, depth + 1, out)
}
