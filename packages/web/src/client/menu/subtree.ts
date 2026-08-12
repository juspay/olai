/**
 * What hangs under a row, answered twice: how MUCH of it there is, and what it
 * READS as.
 *
 * Both questions are asked by the `•••` menu and both are about the drawn tree
 * rather than about the store — the rows the format already expanded for this
 * reading ({@link ../../../../format/src/derive.ts}), mirrors resolved, order
 * settled. Pure over those rows, so the two things most easily got wrong here
 * — a count that says a different number from what the write moves, and an
 * indent that does not survive a paste — are unit tests rather than a browser
 * gesture nobody repeats.
 *
 * THE ONE RULE BOTH SHARE is what a mirror row means. A placement's own record
 * is `{id, parent, ord, mirror}` and nothing else: what is drawn beneath it
 * belongs to the node it shows, which lives somewhere else entirely and is not
 * moving anywhere. So the two answers part company there, and each parts the
 * way its own question demands — the count STOPS at a placement, because
 * archiving is over records in one file; the text DESCENDS through it, because
 * what a reader copies is what a reader can see.
 */

import { isMirror, type Row } from "@olai/format"

/**
 * How many rows a subtree write would take with it — the number the archive
 * confirm names, and it has to be the number the op actually moves.
 *
 * `archive_node` moves the records whose `parent` chain reaches this node,
 * which is same-file by the format. A placement among them goes as the one
 * line it is; the node it shows, and everything under THAT, stays exactly
 * where it is. So the walk counts a mirror row and does not descend into it,
 * and a kitchen holding a mirror of the herb bed says "and the 7 rows under
 * it" rather than counting the basil and the mint somebody else is growing.
 */
export const under = (row: Row): number =>
  row.children.reduce(
    (count, child) => count + 1 + (isMirror(child.at.node) ? 0 : under(child)),
    0,
  )

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
export const asText = (row: Row): string => lines(row, 0).join("\n")

const lines = (row: Row, depth: number): ReadonlyArray<string> => {
  if (row.kind !== "node" && row.kind !== "mirror") return []
  const pad = INDENT.repeat(depth)
  const note = row.shows.node.desc
  return [
    `${pad}${row.shows.node.title}`,
    ...(note === undefined
      ? []
      : note.split("\n").map((line) => (line === "" ? "" : `${pad}${INDENT}${line}`))),
    ...row.children.flatMap((child) => lines(child, depth + 1)),
  ]
}
