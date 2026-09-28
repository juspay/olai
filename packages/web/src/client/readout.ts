/**
 * A chrome readout: a mark, two or three words, and a sentence behind them.
 *
 * The header has two — the connection, and the Commit pill — and they are the
 * same OBJECT even though they answer different questions: "is this page still
 * reading?" and "is what gets written to it being kept?". So the shape they are
 * drawn in lives here rather than twice, which is a correctness matter and not
 * tidiness: the bar is a fixed height, both labels truncate rather than wrap,
 * and a wrap inside it pushed the first row off the top of a 390pt phone. Two
 * copies of that geometry is one place for it to be fixed and another to stay
 * broken.
 *
 * There were THREE, and the third was git's own `● git` chip — retired by
 * `one-git-indicator`, because it and the Commit pill answered one question
 * side by side. Its states are the pill's faces now; this shape outlived it
 * because the pill wears it too.
 *
 * What is NOT here is what either of them SAYS. The tables live beside the
 * thing they report on (`./connection/status.ts`), because
 * a state's appearance is an argument about that state — and neither of them
 * should have to be edited to add a third readout.
 */

/** How one state of a readout is drawn. */
export interface Look {
  /** The dot. A background utility, because the dot IS the colour. */
  readonly dot: string
  /** Two or three words, on screen next to the dot. */
  readonly label: string
  /** What that means, spelled out — the longer sentence a reader gets from the
   *  tip or the `title`, and (where there is one) the `aria-label` that keeps it
   *  from being hover-only. */
  readonly detail: string
}

import { LAYER } from "./layer.ts"

/** THE STATUS ROW every chrome readout wears — the connection, the Commit
 *  readout, each plugin's (kolu, odu, mail, spaces) and the uptime line. It
 *  used to be a rounded chip standing in the bar; the bar now carries ONE
 *  health dot and these are the rows of the popover it opens
 *  (`olai-plugin-layout`'s `Health.tsx`), so the shape is a row on the
 *  panel's ground: ink words, no border, a quiet hover where the row is a
 *  control (`enabled:` matches a button and never a span, so a readout that
 *  opens nothing does not pretend to).
 *
 *  No `truncate` here, and no `min-w-0` either. Those belong on the LABEL
 *  inside, because `overflow: hidden` on this box would clip the mark.
 *
 *  44px tall below 48rem for a thumb; the popover is desktop-only today, but a
 *  row is a row wherever it lands. */
export const PILL =
  "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-body " +
  "text-ink/80 enabled:hover:bg-pill/60 enabled:cursor-pointer " +
  "min-h-11 md:min-h-0"

/** The same row's shape for a DOOR at the foot of the popover (the plugins
 *  panel's): the readout row, always a control. */
export const STATUS_ROW = PILL

/** The dot itself, which the state's own `dot` utility colours. */
export const DOT = "inline-block size-2 shrink-0 rounded-full"

/**
 * THE WARNING REGISTER — a readout's "wants attention, is not broken" face
 * (the kolu watcher gone quiet). It used to be a hand-picked amber on the
 * ink bar; a row on the panel's ground wears the theme's own `doing` ink,
 * which is what the health dot's `notice` tone wears too — one colour for
 * one meaning, in every palette.
 */
export const PILL_WARN_COAT = ""
/** The dot's HOLLOW face — the same round, emptied. */
export const DOT_HOLLOW_WARN = "!bg-transparent border-2 !border-doing"
/** The quiet sentence's ink, beside the dot's. */
export const TEXT_WARN = "text-doing"

/**
 * THE ALARM REGISTER — a refused post, a missing permission. Same ink
 * git's error face wears (`text-alarm`), and the health dot's `alarm` tone.
 */
export const PILL_ALARM_COAT = ""
export const DOT_HOLLOW_ALARM = "!bg-transparent border-2 !border-alarm"
export const TEXT_ALARM = "text-alarm"

/**
 * The other shape in the bar: a BUTTON with a glyph on it — the agent toggle
 * and the preferences trigger.
 *
 * Height is `touch.ts`'s 44px below 48rem, same as {@link PILL}, because a
 * miss vertically lands on the outline under the bar. WIDTH is not: four 44px
 * squares plus `live` plus the commit mark do not fit on a 360pt phone, and a
 * sideways miss in this cluster hits the neighbour, not nothing — the same
 * exception the gutter already makes (`touch.ts`). What is NOT here is the
 * border colour: the agent toggle's says whether a turn is running and the
 * preferences' says whether the panel is open, which is each button's own
 * news rather than this shape's.
 */
export const ICON_BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-full " +
  "border border-paper/20 bg-paper/10 px-2 py-1.5 text-label text-paper/80 hover:text-paper sm:px-3 " +
  "min-h-11 md:min-h-0"

/**
 * Phone news, under the bar: a full-width strip, paper on the page, 44px
 * tall. The PILL is a chip in a toolbar; this is an interruption of the
 * page. Tone (`text-doing`, `text-alarm`) is the state's, not this shape's
 * — same split as {@link ICON_BUTTON}'s border.
 */
export const BANNER =
  "flex min-h-11 w-full items-center gap-2 border-b border-rule bg-paper " +
  "px-4 py-2.5 text-left text-body"

/**
 * THE BOX A PORTALLED PANEL WEARS — the preferences panel, the plugins panel,
 * the Commit panel, and the one a plugin's chrome readout hangs off.
 *
 * Four of them, and it was written out four times. The fourth was written in
 * the same commit as a comment two files away asserting there could not be one:
 * `plugins/furniture.tsx`'s popover says *"the panel is the same shape
 * `../commit/Panel.tsx` and `../settings/Panel.tsx` wear, folded in here so a
 * plugin cannot wear a fourth."* A convention kept by memory is a convention
 * that has already been broken by whoever was not remembering.
 *
 * What is in it is the set of decisions a panel does not get to make, and each
 * fails silently on its own:
 *
 *   - NO `w-*`. The anchor writes the width inline (`./anchor.ts`), so a class
 *     here could never beat it and would only look like it was in charge.
 *   - `overflow-x-hidden` beside the y scroll, because a panel that scrolls
 *     sideways is a panel whose content escaped its measured width.
 *   - `LAYER.over` — above the page, below the modals that must cover the bar.
 *     One notch wrong and it paints under the bar it hangs from.
 *   - focusable, never in the tab order: opening puts the caret IN the panel so
 *     a keyboard is standing inside it rather than beside it.
 *
 * NO `gap-*`, and that is the one thing the four legitimately differ in — each
 * picks its own row rhythm. It is spelled at the call site rather than
 * parameterised here, because a constant taking an argument to vary the only
 * thing it does not own would be this shape pretending to own it.
 */
export const PANEL_BOX = `fixed ${LAYER.over} ` +
  "flex min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain " +
  "rounded-surface border-0 bg-panel p-4 text-body shadow-overlay ring-1 ring-rule/40 focus:outline-none"
