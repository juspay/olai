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

import type { Progress, Status } from "@olai/format"

/** As much of a row as counting needs. `Row` satisfies it — its mark is an
 *  OPTIONAL key since the row shape became a schema the wire carries, so this
 *  says the same, and a row with nothing marked reads the same either way. */
export interface Branch {
  readonly status?: Status | undefined
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

/**
 * ...and whether the fold should SAY it, which is a different question.
 *
 * A collapsed row usually carries the rollup too (`./hot.ts`), and on most
 * branches those two are the same number twice: `3/4` already reports three
 * finished tasks, so `+3 done` beside it is the second, dumber spelling of one
 * fact — the redundancy this codebase keeps closing (`one-git-indicator`, the
 * theme pill, the done pill). The human ruled it out on sight of the first
 * build: where the rollup says it, the fold says nothing.
 *
 * IT IS NOT ALWAYS THE SAME NUMBER, which is the whole reason this is a
 * comparison rather than "drop the count on any branch with a rollup". The two
 * count different things:
 *
 *   - the ROLLUP is the row's own children and only those — `progressOf` is
 *     deliberately one level deep, because `3/5` beside a title is about the
 *     five rows drawn under it — and it never counts a mirror;
 *   - this COUNT is every done row the fold hid, at every depth, mirrors
 *     included, because that is what stopped being visible.
 *
 * So a branch whose finished work sits under an unmarked child, or arrives
 * through a mirror, has a rollup that does not know about it — and there the
 * count is the only thing that says so. `house.org`'s `kitchen` is exactly
 * that: `1/2` beside it, two done rows inside it.
 */
export const foldSays = (
  /** How many done rows the fold hid — `undefined` on a row that is not
   *  collapsed, which is not a fold and reports nothing. */
  folded: number | undefined,
  /** The rollup the same row is already drawing, when it draws one. */
  rollup: Progress | undefined,
): number | undefined => {
  if (folded === undefined || folded === 0) return undefined
  return rollup?.done === folded ? undefined : folded
}
