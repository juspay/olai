/**
 * How a node's mark colours the title it belongs to.
 *
 * Status is a property of the thing being drawn, so it styles the title
 * directly rather than through a `[data-status]` descendant rule — and it is
 * one table rather than two, because a row and the heading of that row's own
 * page are the same node and have no business looking finished differently.
 *
 * ONE TONE FOR THREE MARKS now, and the two it lost are the quiet outline's
 * ruling (human). The glyph column is where a mark is said — one accented glyph
 * in the whole vocabulary, and it is `doing` (./marks.tsx) — so a title that ALSO
 * turned the accent colour was the same fact painted twice, at the width of the
 * words instead of the width of a glyph. On a board where half the rows are
 * under way that is a page of blue. `doing` therefore reads as ordinary text
 * beside an accented glyph, which is exactly what "work in flight" should look
 * like when it is most of the tree.
 *
 * `done` keeps a tone because it is the one mark that has to be readable AND out
 * of the way: it RECEDES into the muted ink instead of the green it used to
 * wear, with the strike still saying what it says. Green on every finished row
 * was the outline congratulating itself, at exactly the size of a page of them.
 *
 * A node with no status is plain text and that is the point: an unmarked
 * bullet is not an unstarted task, so nothing about it is toned. Neither is a
 * `todo` — work that has not started reads as what it says, and its BOX is
 * where it says it (./marks.tsx).
 */

import type { Status } from "@olai/format"

const TONE: Record<Status, string> = {
  done: "text-muted line-through decoration-muted/60",
  doing: "",
  todo: "",
}

export const toneOf = (status: Status | undefined): string =>
  status === undefined ? "" : TONE[status]
