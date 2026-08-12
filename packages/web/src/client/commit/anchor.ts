/**
 * Where the Commit panel goes, given where its pill is.
 *
 * The panel cannot be laid out inside the sidebar. The sidebar scrolls
 * (`Sidebar.tsx`'s `overflow-y-auto`), and an overflow container clips in BOTH
 * axes — so a popover wider than the 16rem column was cut off at the column's
 * edge, taking the commit message, the writer and half the button with it. It
 * is rendered in a portal and positioned against the VIEWPORT instead, which is
 * why this arithmetic exists at all.
 *
 * PURE, and taking the viewport as an argument: the interesting cases are a
 * pill near an edge and a window too short for the panel, and none of them is
 * something to go looking for by resizing a browser by hand.
 */

/** What a `getBoundingClientRect()` gives us, and the only parts of one this
 *  needs. */
export interface Box {
  readonly left: number
  readonly top: number
  readonly bottom: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

/** Everything the panel needs to place itself, in CSS pixels from the
 *  viewport's edges. */
export interface Anchor {
  readonly left: number
  readonly width: number
  /** How tall it may grow before it scrolls inside itself. */
  readonly maxHeight: number
  /**
   * Which edge {@link Anchor.offset} is measured from — which is to say, which
   * way the panel opens.
   *
   * `bottom` is the ordinary answer, because the pill lives at the bottom of
   * the screen in both of its homes and a panel that opened downward from there
   * would have nowhere to go. `top` is what happens when the pill is high up
   * anyway: on a phone the sidebar is a header rather than a column, and a
   * panel opening upward from there would be a zero-height box.
   */
  readonly side: "bottom" | "top"
  readonly offset: number
}

/** How far the panel sits from the pill, and how close it may come to the
 *  edges of the window. */
const GAP = 8
const MARGIN = 12

/** What the panel wants when there is room: 24rem at this app's root size. */
const WANTED = 384

export const anchoredTo = (pill: Box, view: Viewport): Anchor => {
  // Never wider than the window has room for — on a phone that is the whole
  // width less the margins, which is why the width is computed here rather
  // than left to CSS: the left edge below has to be clamped against the same
  // number, and two answers could disagree.
  const width = Math.max(0, Math.min(WANTED, view.width - MARGIN * 2))
  // Aligned to the pill, and pushed back inside when the pill is near the
  // right edge — which is where it is on every page that has no sidebar.
  const left = Math.max(MARGIN, Math.min(pill.left, view.width - width - MARGIN))

  // Whichever side has more room. Ties go upward, which is the direction the
  // pill's own position asks for.
  const above = Math.max(0, pill.top - GAP - MARGIN)
  const below = Math.max(0, view.height - pill.bottom - GAP - MARGIN)
  return above >= below
    ? { left, width, side: "bottom", offset: view.height - pill.top + GAP, maxHeight: above }
    : { left, width, side: "top", offset: pill.bottom + GAP, maxHeight: below }
}
