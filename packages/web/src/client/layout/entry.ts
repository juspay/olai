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
  `flex ${TARGET} items-center break-all rounded-xl px-2.5 py-1 text-[0.875rem] leading-snug ` +
  "no-underline hover:bg-paper/10 aria-[current=page]:bg-accent/30 " +
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

/**
 * ONE REGION of the directory column, and the label over it.
 *
 * The column below the month was one undifferentiated run of rows — the pins,
 * the tree, the two ways to make a file, and the Trash all drawn as the same
 * entry, one after another (human, 2026-08-19, on a screenshot: *why does the
 * sidebar look like mush?*). Each of those is a different KIND of thing: what
 * a reader kept, what the directory holds, what makes a new one, and the way
 * out. The glyph on a row says what one row IS; it cannot say where one list
 * ends.
 *
 * NOTHING NEW IS INVENTED HERE. The two pieces are the ones this app already
 * groups lists with: a hairline (`border-t border-rule`, the `•••` menu's own
 * separator between its reads and its writes, and the preferences panel's
 * footer) and a quiet uppercase label (`../palette/Shortcuts.tsx` over each
 * group of keys, `../chat/CompletionMenu.tsx` over each kind of completion,
 * `../commit/Panel.tsx` over its sections). The month above is the third: a
 * card with a heading, which is the same idea with a border round it.
 *
 * The label is MUTED and small, because it is chrome rather than content —
 * the month's heading is the name of the month a reader is looking at, and
 * these are names for lists that already say what they hold.
 */
export const REGION = "mt-3 border-t border-paper/15 pt-2"

/**
 * WHAT IT MAY NOT COST is the tree's place on a short screen, and that is a
 * promise with a test behind it: the column is sticky and exactly one screen
 * tall, and `features/the_sidebar_sticks.feature` holds that the FILE TREE
 * still reaches the visible strip at the bottom of a long page — it is what a
 * reader came back to the column for. The month above it is ~300px of a 400px
 * window, so everything between the two is a budget rather than a free choice:
 * the first draft of these regions spent 45px on a rule, a margin and a label
 * over the tree, and pushed it 28px under the fold (caught by that scenario,
 * 2026-08-19). Hence the tighter spacing here, the month's own bottom margin
 * giving way to it (`../calendar/Calendar.tsx`), and exactly ONE label below
 * the month — the shelf's, because a list that is new to a reader is the one
 * that needs naming. The tree is what the column IS; a rule above it says
 * where it starts.
 */

/** …and the words over it. `px-2` so the label sits on the same left edge as
 *  the rows under it — an entry's own padding — rather than hanging a couple of
 *  pixels outside the column of names ({@link ENTRY_SHAPE}). */
export const REGION_LABEL =
  "m-0 mb-1 px-2.5 font-serif text-[0.75rem] italic tracking-tight text-muted"
