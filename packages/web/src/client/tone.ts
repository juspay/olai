/**
 * How a node's mark colours the title it belongs to.
 *
 * Status is a property of the thing being drawn, so it styles the title
 * directly rather than through a `[data-status]` descendant rule — and it is
 * one table rather than two, because a row and the heading of that row's own
 * page are the same node and have no business looking finished differently.
 *
 * ONE TONE FOR THE UNSETTLED MARKS, and the two it lost are the quiet
 * outline's ruling (human). The glyph column is where a mark is said — one
 * accented glyph in the whole vocabulary, and it is `doing` (./marks.tsx) — so a
 * title that ALSO turned the accent colour was the same fact painted twice, at
 * the width of the words instead of the width of a glyph. On a board where half
 * the rows are under way that is a page of blue. `doing` therefore reads as
 * ordinary text beside an accented glyph, which is exactly what "work in
 * flight" should look like when it is most of the tree.
 *
 * THE TWO SETTLING MARKS KEEP A TONE, and it is the SAME tone, which is the one
 * decision in this file worth arguing. `done` has it because it is a mark that
 * has to be readable AND out of the way: it RECEDES into the muted ink instead
 * of the green it used to wear, with the strike still saying what it says.
 * Green on every finished row was the outline congratulating itself, at exactly
 * the size of a page of them. `cancelled` takes the identical string (the human
 * asked for a struck-through row, 2026-08-25) because what the strike SAYS is
 * "nobody is waiting on this line" — which is precisely and exactly what the
 * two marks share, and it is the only thing they share.
 *
 * WHICH of them a row is, is the GLYPH's answer and not this file's: a check in
 * a box against a cross through one (./marks.tsx). That is the same division of
 * labour `doing` already lives under — the mark is said in the gutter, at the
 * width of a glyph, and the title says only how much attention the row is still
 * asking for. Two strikes in two colours would be this file taking the glyph
 * column's job at the width of the words, which is the whole thing the quiet
 * outline's ruling took away.
 *
 * A node with no status is plain text and that is the point: an unmarked
 * bullet is not an unstarted task, so nothing about it is toned. Neither is a
 * `todo` — work that has not started reads as what it says, and its BOX is
 * where it says it (./marks.tsx).
 */

import type { Status } from "@olai/format"

/** The muted strike the settling marks share. One string, named, so the two
 *  entries below are visibly the same answer rather than two that happen to
 *  match — and so a restyle moves both. */
const SETTLED = "text-muted line-through decoration-muted/60"

const TONE: Record<Status, string> = {
  done: SETTLED,
  cancelled: SETTLED,
  doing: "",
  todo: "",
}

export const toneOf = (status: Status | undefined): string =>
  status === undefined ? "" : TONE[status]
