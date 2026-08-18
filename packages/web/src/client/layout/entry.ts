/**
 * ONE ROW OF THE DIRECTORY COLUMN, as a class — everything about its box,
 * its hover and its current-page wash EXCEPT what colour the words are.
 *
 * It lived in `../Sidebar.tsx` while that file drew every row there was. It
 * moved here when a second one appeared: the pinned shelf's rows sit in the
 * same column, a hand's width above the file tree, and a hover or a wash that
 * differed between the two would be two rows of one list looking like two
 * lists. Here rather than in either file for the reason `./Handle.tsx` and
 * `./Rail.tsx` are here — this directory owns the column's own chrome, and
 * neither the tree nor the shelf is the natural home for what they share.
 *
 * THE INK IS SPLIT OUT, and that is the part to keep: the agenda's entry
 * changes it (`../agenda/owed.ts`), and two utilities setting one property are
 * settled by the order Tailwind emitted its rules in rather than by the order
 * they were written — appending `text-alarm` to a class that already says
 * `text-ink` is a coin toss, which is the trap `../calendar/Day.tsx` composes
 * per-property to avoid. So every user of this names an ink, and exactly one
 * of them names something other than the ordinary one.
 */

import { TARGET } from "../touch.ts"

export const ENTRY_SHAPE =
  `flex ${TARGET} items-center break-all rounded-md px-2 py-0.5 text-[0.8125rem] leading-snug ` +
  "no-underline hover:bg-rule/50 aria-[current=page]:bg-accent/15 " +
  "aria-[current=page]:text-accent aria-[current=page]:font-semibold md:min-h-0"

/** The space between the things ON a row — a glyph, a name, and whatever the
 *  row has to say after it.
 *
 *  ONE gap for every kind of row, spelled once, because the rows agreeing is a
 *  promise and not a coincidence: a folder's name, a file's name and a pin's
 *  name are read as one column of names, and a row that took a different gap
 *  would put its names a couple of pixels off every other one's for as long as
 *  nobody looked. Named for the same reason `../touch.ts` names the tree's
 *  `GUTTER_GAP` rather than repeating it down the row: a gap that is written
 *  twice is a rule, and a rule is what nothing enforces. */
export const ROW_GAP = "gap-1.5"
