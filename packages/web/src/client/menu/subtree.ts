/**
 * What hangs under a row, answered twice: how MUCH of it there is, and what it
 * READS as.
 *
 * Both questions are the `•••` menu's, and they are asked of DIFFERENT THINGS
 * — which is the whole content of this module:
 *
 *   - the COUNT is about the write, so it is asked of the SET
 *     ({@link Derived}, the same index the ops layer's own subtree walk
 *     descends). What a person is being asked to agree to is how much
 *     `archive` will move, and that is a fact about the records on disk.
 *   - the TEXT is about the reading, so it is asked of the ROWS — the tree the
 *     format expanded for this page, mirrors resolved, order settled. What a
 *     person copies is what a person can see.
 *
 * That split is not a nicety. The rows a page hands the tree are a READING:
 * with done hidden, `withoutDone` has already dropped every finished branch
 * from them (`view.ts`), so a count taken from the rows would have said "and
 * the 3 rows under it" over a branch of nine and archived all nine. The
 * sentence the confirm exists to be honest about was the one thing that could
 * not be read off the picture.
 *
 * Pure over its inputs, both of them, so the two things most easily got wrong
 * — a count that differs from what the write moves, and an indent that does
 * not survive a paste — are unit tests rather than a browser gesture nobody
 * repeats.
 */

import type { Derived, Row } from "@olai/format"

/**
 * How many records a subtree write would take with it — the number the archive
 * confirm names, and it has to be the number the op actually moves.
 *
 * The same edges `@olai/ops`' `subtreeOf` descends, over the same index: the
 * records whose `parent` chain reaches this node, which is same-file by the
 * format. A PLACEMENT among them goes as the one line it is and is not
 * descended into — not by a rule spelled here, but because a mirror cannot be
 * a parent (the validator refuses one), so it has no children in this index.
 * A kitchen holding a mirror of the herb bed therefore says "and the 5 rows
 * under it" rather than counting the basil and the mint somebody else is
 * growing.
 *
 * The `seen` guard is the ops walk's too, and for its reason: a `parent` loop
 * is a set the validator condemns, but this runs in a browser holding whatever
 * the store published, and the worst answer to a malformed set is a tab that
 * stops responding.
 */
export const under = (derived: Derived, id: string): number => {
  const seen = new Set<string>()
  const walk = (at: string): number => {
    if (seen.has(at)) return 0
    seen.add(at)
    return (derived.children.get(at) ?? []).reduce(
      (count, child) => count + 1 + walk(child.node.id),
      0,
    )
  }
  return walk(id)
}

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
