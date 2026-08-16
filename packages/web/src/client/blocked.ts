/**
 * How a row says it cannot start yet, in the two ways that are not the mark
 * column's (./marks.tsx).
 *
 * Both live here rather than at the three places a node is drawn — a tree row,
 * a day entry, and whatever draws one next — because they are one decision
 * each, and a second copy is where a row and a day entry start disagreeing
 * about what waiting looks like.
 */

import type { InTheWay } from "@olai/format"

/**
 * The row's own dim: enough to fall behind the rows that can be started,
 * nowhere near what a reader would take for finished.
 *
 * DELIBERATELY NOT the done treatment, which is a colour and a strike
 * (./tone.ts): those say "this happened", and a blocked row is the opposite —
 * nothing has happened and nothing can until something else does. Dimming
 * says only "not yours to pick up right now", which is exactly the claim.
 *
 * Applied to a row's LINE and its body, never to the item that contains them:
 * opacity compounds through a subtree, so an `<li>` would take every row
 * nested under it down with it, and twice over where a blocked row sits under
 * a blocked row.
 */
export const WAITING_DIM = (blocked: ReadonlyArray<InTheWay>): string =>
  blocked.length > 0 ? "opacity-60" : ""

/**
 * The ids a node is waiting on, space-separated and in the order the format
 * promises — or `undefined`, which is how an attribute says nothing at all.
 *
 * A `data-` fact rather than a colour, for the reason every other `data-` on a
 * row exists: the dim above is a styling decision a refactor is entitled to
 * change, and "is this row blocked, and by what" is not.
 */
export const blockedIds = (
  blocked: ReadonlyArray<InTheWay>,
): string | undefined =>
  blocked.length === 0 ? undefined : blocked.map((one) => one.at.node.id).join(" ")
