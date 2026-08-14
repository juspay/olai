/**
 * Which rows a SWEEP crosses — the whole of drag-across that is arithmetic.
 *
 * Workflowy's fifth picking gesture: press where the outline is not and pull,
 * and the rows the pull passes over are picked. Pure over measured rows, the
 * way `./plan.ts` is and for the same reason: what a gesture reaches, and where
 * the shape promising it goes, are one answer computed once rather than two
 * readings of the page that could disagree.
 *
 * **IT IS A BAND, NOT A BOX**, and that is the one real decision in here. A
 * rubber-band rectangle asks about two axes, and the second one has no meaning
 * over an outline: a row is a LINE, drawn as far in as its depth says, so a
 * rectangle drawn down the left of the page would cross a root and miss the
 * grandchild indented past its right edge — which is a rule about pixels
 * pretending to be a rule about the tree. So the sweep reads Y and spans the
 * rows' own width, and what is DRAWN is exactly that (`./Sweep.tsx`): the shape
 * on screen is the shape the answer was computed from, which is the promise
 * every affordance in this client is held to.
 *
 * **WHAT COMES OUT IS A RUN WITH TWO ENDS**, and the ends are not
 * interchangeable. A sweep is a range gesture, so where it BEGAN is the anchor
 * a later shift-click or Shift+arrow measures from and where it ENDED is the
 * focus those move — the same two ends `./../select/selection.ts` already keeps
 * for the other four gestures. Sweeping upward and sweeping downward over the
 * same rows are therefore different answers, which is what a person means by
 * them.
 *
 * The run is always CONTIGUOUS in drawn order, because a band is: that is what
 * lets the whole gesture land on the selection as one `across` rather than as a
 * set nothing else here could describe.
 */

/** One drawn row, as measured on screen — in the document coordinates the rows
 *  were measured in, so the answer survives the page scrolling under a live
 *  gesture (`../autoscroll.ts`). */
export interface Line {
  /** `Row.key` — the PLACE, which is what a selection names. */
  readonly key: string
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

/** The rows a band crosses, with its two ends named. */
export interface Run {
  /** Every place it crosses, in drawn order. */
  readonly keys: ReadonlyArray<string>
  /** The end the press began at — the anchor. */
  readonly from: string
  /** The end the pointer is at — the focus. */
  readonly to: string
}

/**
 * A live sweep: what it would pick, and where the band that promises it goes.
 *
 * ONE value, for the reason {@link ./plan.ts}'s `Landing` is one: a caller that
 * took the run and then measured the band for itself would be reading the same
 * rows twice.
 */
export interface Sweep {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly width: number
  /** `null` while the band crosses nothing — which is a real state and not an
   *  absence: a sweep that has begun below the last row and not yet reached it
   *  is a live gesture picking nothing, and the band still has to be drawn. */
  readonly run: Run | null
}

/**
 * What a sweep from `fromY` to `toY` over these rows is asking for.
 *
 * `null` when there are no rows at all — an empty outline has nothing to sweep,
 * so there is nothing to draw either, and a band over an empty page would be a
 * gesture promising a pick it cannot make.
 *
 * A row is CROSSED when the band touches it anywhere, edges included. Not the
 * middle-crossing rule the drop planner uses: that one is choosing between two
 * gaps and wants a snap, and this one is asking "did the pull pass over this
 * line", where clipping the top of a row and not picking it is the answer
 * nobody means.
 */
export const planSweep = (
  rows: ReadonlyArray<Line>,
  fromY: number,
  toY: number,
): Sweep | null => {
  if (rows.length === 0) return null
  const top = Math.min(fromY, toY)
  const bottom = Math.max(fromY, toY)
  const keys: Array<string> = []
  // One pass for both halves: which rows are crossed, and how wide the rows
  // are. A reduce per edge would be three walks of the same array per frame.
  let left = Infinity
  let right = -Infinity
  for (const row of rows) {
    if (row.left < left) left = row.left
    if (row.right > right) right = row.right
    if (row.bottom >= top && row.top <= bottom) keys.push(row.key)
  }
  const first = keys[0]
  const last = keys[keys.length - 1]
  const ends = first === undefined || last === undefined
    ? null
    // Which end is the anchor is which way the pull went, and a sweep that has
    // not left its own line yet (`toY === fromY`) is read as downward — the
    // direction the next pixel of an unfinished gesture is most likely to go,
    // and a one-row run where both ends are the same row either way.
    : toY >= fromY
    ? { from: first, to: last }
    : { from: last, to: first }
  return {
    top,
    bottom,
    left,
    width: Math.max(0, right - left),
    run: ends === null ? null : { keys, from: ends.from, to: ends.to },
  }
}
