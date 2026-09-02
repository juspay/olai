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
 * thing they report on (`./connection/status.ts`, `./commit/said.ts`), because
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

/** The pill both readouts wear, minus the width each one caps itself at. Quiet
 *  by construction — a border, paper and muted text — because chrome that
 *  competes with the outline is chrome a reader learns to skip.
 *
 *  No `truncate` here, and no `min-w-0` either. Those belong on the LABEL
 *  inside — the connection's words, the Commit pill's sentence — because
 *  putting them on this box was how a 360pt bar crushed the Commit pill to an
 *  empty oval: `min-w-0` let the box shrink past its mark, and `overflow:
 *  hidden` (what `truncate` is) clipped the mark that `shrink-0` had promised
 *  would stay. The label already truncates. The box is a chip.
 *
 *  Height matches {@link ICON_BUTTON} below 48rem, so a live pill and the
 *  agent toggle are one toolbar rather than a compact chip beside two 44px
 *  circles. Released on a pointer, same as that button. */
export const PILL =
  "flex items-center gap-1.5 rounded-full border border-paper/20 " +
  "bg-paper/10 px-2 py-1.5 text-xs text-paper/80 sm:gap-2 sm:px-3 " +
  "min-h-11 md:min-h-0"

/** The dot itself, which the state's own `dot` utility colours. */
export const DOT = "inline-block size-2 shrink-0 rounded-full"

/**
 * THE INFRASTRUCTURE-WARNING REGISTER — the pill's one non-status face.
 *
 * The bar's loud colours already have a ruling: violet (`styles.css`'s
 * `--color-alarm` and `--color-doing`'s siblings) is what an AGENT's ask
 * for a human wears — the board's `blocked` column, the skew chip's
 * "upgrade me". The PILL's new face (the watcher gone silent) is the
 * other kind of wrong: something of this machine's OWN is broken, rather
 * than a human is owed, and it gets AMBER as a third, smaller family so
 * the two are never one glance's confusion. The inks are the prototype's
 * own (`projects/olai/prototypes/pill-mock.png`): a hollow dot, a warm
 * coat on the chip, and a warm word beside it.
 */
export const PILL_WARN_COAT = "!border-[#e0a83c] shadow-[0_0_0_1px_#e0a83c66]"
/** The dot's HOLLOW face — the same round, emptied. */
export const DOT_HOLLOW_WARN = "!bg-transparent border-2 !border-[#e0a83c]"
/** The quiet sentence's ink, beside the dot's. */
export const TEXT_WARN = "text-[#f0c46a]"

/**
 * THE ALARM REGISTER — a refused post, a missing permission. Same ink
 * git's error face wears (`text-alarm`), so a Spaces fault is not the
 * amber of "the watcher went quiet".
 */
export const PILL_ALARM_COAT = "!border-alarm shadow-[0_0_0_1px] shadow-alarm/40"
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
  "border border-paper/20 bg-paper/10 px-2 py-1.5 font-mono text-xs text-paper/80 hover:text-paper sm:px-3 " +
  "min-h-11 md:min-h-0"

/**
 * Phone news, under the bar: a full-width strip, paper on the page, 44px
 * tall. The PILL is a chip in a toolbar; this is an interruption of the
 * page. Tone (`text-doing`, `text-alarm`) is the state's, not this shape's
 * — same split as {@link ICON_BUTTON}'s border.
 */
export const BANNER =
  "flex min-h-11 w-full items-center gap-2 border-b border-rule bg-paper " +
  "px-4 py-2.5 text-left text-sm"
