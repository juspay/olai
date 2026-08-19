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
 *  competes with the outline is chrome a reader learns to skip. */
export const PILL =
  "flex min-w-0 items-center gap-1.5 truncate rounded-full border border-paper/20 " +
  "bg-paper/10 px-2 py-1.5 text-xs text-paper/80 sm:gap-2 sm:px-3"

/** The dot itself, which the state's own `dot` utility colours. */
export const DOT = "inline-block size-2 shrink-0 rounded-full"

/**
 * The other shape in the bar: a BUTTON with a glyph on it — the agent toggle
 * and the preferences trigger.
 *
 * Same argument as {@link PILL} one paragraph up, and the same geometry to keep
 * in step: both take `touch.ts`'s 44px minimum below 48rem, because a glyph on
 * its own is a target a finger misses sideways as well as vertically, and both
 * release it on a pointer. What is NOT here is the border colour: the agent
 * toggle's says whether a turn is running and the preferences' says whether the
 * panel is open, which is each button's own news rather than this shape's.
 */
export const ICON_BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-full " +
  "border border-paper/20 bg-paper/10 px-2 py-1.5 font-mono text-xs text-paper/80 hover:text-paper sm:px-3 " +
  "min-h-11 min-w-11 md:min-h-0 md:min-w-0"
