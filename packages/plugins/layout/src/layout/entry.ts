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
 * they were written. The ordinary row inherits paper from the spine
 * (`.olai-frame`); the alarm names its own. The trap `../calendar/Day.tsx`
 * composes per-property to avoid.
 *
 * THE CURRENT-PAGE ROW READS IN PAPER, not in the accent, and the accent is
 * the WASH behind it. Accent-on-accent-wash is the same hue at two strengths:
 * 2.27:1 in reef, 1.19:1 in aurora — every palette in the table fails AA on
 * it, and it is the one row whose whole job is saying which page you are
 * standing on. Paper on that wash clears AA in every palette. The coral still
 * marks the row; it just no longer has to be legible as type at the same time.
 */

import { TARGET } from "@olai/ui-primitives/touch.ts"

export const ENTRY_SHAPE =
  `flex min-w-0 ${TARGET} items-center rounded-xl px-2.5 py-1 text-[0.875rem] leading-snug ` +
  "no-underline hover:bg-paper/10 aria-[current=page]:bg-accent/30 " +
  "aria-[current=page]:text-paper aria-[current=page]:font-semibold md:min-h-0"

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
 * WHAT SAYS WHERE ONE LIST ENDS is space and a label, not a rule. The first
 * drawing used a hairline (`border-t`) over every region as well; the 2026-09
 * simplification (an Apple-like quiet list, owner's mockup) dropped it — a
 * rule over every group is five lines drawn across the column for what a gap
 * already says — and kept the label, the quiet uppercase one this app groups
 * lists with elsewhere (`../palette/Shortcuts.tsx` over each group of keys,
 * `../chat/CompletionMenu.tsx` over each kind of completion).
 *
 * The label is MUTED and small, because it is chrome rather than content:
 * these are names for lists that already say what they hold.
 */
export const REGION = "mt-4"

/**
 * WHAT IT MAY NOT COST is the tree's place on a short screen, and that is a
 * promise with a test behind it: the column is sticky and exactly one screen
 * tall, and `packages/plugins/sidebar/e2e/features/the_sidebar_sticks.feature`
 * holds that the FILE TREE still reaches the visible strip at the bottom of a
 * long page — it is what a reader came back to the column for. The month used
 * to be ~240px of the 328px the column has on a 400px window; it is one row
 * now until a reader opens it (journal's `Today` row), which is what paid for
 * the gap above each region. A reader who keeps the month open is back on the
 * old budget, so the gap stays one step and not two.
 */

/** …and the words over it. `px-2.5` so the label sits on the same left edge as
 *  the rows under it — an entry's own padding — rather than hanging a couple of
 *  pixels outside the column of names ({@link ENTRY_SHAPE}).
 *
 *  ONE TREATMENT FOR EVERY HEADING IN THE COLUMN — Pinned, Needs you, Chats,
 *  Outlines — and it is the quiet uppercase label named above, not the serif
 *  italic the regions first wore beside a mono Outlines: two heading voices in
 *  one list read as two lists (the 2026-09 sidebar simplification). Small,
 *  spaced capitals in the muted ink: chrome, not content. The words stay
 *  written in the plugin's own case; `uppercase` is paint, so a screen reader
 *  and a `getByRole` name still read "Chats". */
export const REGION_LABEL =
  "m-0 px-2.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-paper/55"

/**
 * A HEADING THAT CARRIES ITS OWN ACTION — the `+` beside Chats and beside
 * Outlines. The label and the button share one line, the button at the right
 * edge where a row's count sits, so the column keeps one left edge of names.
 *
 * Whose the action is stays the heading's owner's: this is paint only, the way
 * {@link ENTRY_SHAPE} is. Chat draws its `+` over its own engine menu, files
 * over its own new-file menu; nothing here knows either.
 */
export const REGION_HEAD = "mb-1 flex min-h-7 items-center justify-between gap-2"

/** The `+` itself: a quiet square that is a full finger's box below `md`
 *  (`@olai/ui-primitives/touch.ts`) and a 1.5rem one beside a pointer. It is
 *  a real `<button>`, so Tab reaches it and Enter/Space press it. */
export const HEAD_ACTION =
  "inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg " +
  "border-0 bg-transparent text-paper/55 hover:bg-paper/10 hover:text-paper " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent " +
  "disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent " +
  "aria-expanded:bg-paper/10 aria-expanded:text-paper md:min-h-6 md:min-w-6"
