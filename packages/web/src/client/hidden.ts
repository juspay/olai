/**
 * What a COLLAPSED branch is holding back, in the one number worth saying.
 *
 * A fold hides its subtree silently, which is exactly right for work still to
 * do — that is what the triangle is for — and exactly wrong for work that is
 * finished: a reader who collapses `kitchen` and sees nothing has no way to tell
 * "there is nothing under this" from "there are four done rows under this". Done
 * work recedes in the quiet outline (`./marks.tsx`), and a thing that recedes
 * must still be countable, or receding becomes disappearing.
 *
 * So a collapsed row says `+4 done` beside its title, in the same dim voice
 * every other inline fact takes (`./hot.ts`).
 *
 * IT COUNTS THE ROWS OF THIS READING and not the nodes on disk, which is the
 * honest answer rather than a stricter-looking one: a reader who has hidden
 * finished work (`./settings/done.ts`) is handed a tree those rows are already
 * gone from, so this says nothing about them — and the filter bar above the tree
 * is where that preference reports itself, in one place rather than on every
 * folded row.
 *
 * Structurally typed rather than taking `Row`, so the recursion is unit-testable
 * with three literals instead of a hand-built union.
 */

import type { Status } from "@olai/format"

/** As much of a row as counting needs. `Row` satisfies it. */
export interface Branch {
  readonly status: Status | undefined
  readonly children: ReadonlyArray<Branch>
}

/** How many rows UNDER this one are done, at every depth. The row itself is
 *  never counted: it is the one still on screen. */
export const doneUnder = (row: Branch): number => {
  let count = 0
  for (const child of row.children) {
    if (child.status === "done") count += 1
    count += doneUnder(child)
  }
  return count
}
