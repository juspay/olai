/**
 * Where a panel goes, given where the pill that opens it is.
 *
 * A panel cannot be laid out inside the box its trigger lives in. The sidebar
 * scrolls (`Sidebar.tsx`'s `overflow-y-auto`) and an overflow container clips
 * in BOTH axes — so a popover wider than the 16rem column was cut off at the
 * column's edge, taking the commit message, the writer and half the button with
 * it — and the app header is a positioned bar three rem tall, which is not a
 * box a panel of settings can hang out of either. Both are rendered in a portal
 * and positioned against the VIEWPORT instead, which is why this arithmetic
 * exists at all.
 *
 * It sits here rather than beside either of them because it is now the answer
 * for BOTH — the Commit panel (`commit/`) and the preferences panel
 * (`settings/`) — and a copy per popover is a geometry to fix twice.
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
   * `bottom` measures up from the window's bottom edge, so the panel opens
   * UPWARD — the answer for a pill low on the screen, where a panel opening
   * downward would have nowhere to go. `top` is the other way round, and it is
   * what every pill in the app header gets: three rem from the top there is no
   * room above at all, and a panel opening upward from there would be a
   * zero-height box.
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

/**
 * The same answer as CSS, which is the half a panel actually renders.
 *
 * Here rather than in each panel because of the hazard in it: both edges have
 * to be named as STATIC keys with exactly one of them holding a value. A
 * computed key — `[at.side]` — compiles away silently, since Solid reads a
 * style object at build time and emits one `setProperty` per literal key, and
 * the panel comes out with no vertical position at all and sits just below the
 * fold. That cost the Commit panel its placement once; a second copy of this is
 * a second chance to make the same mistake.
 */
export const styleOf = (at: Anchor): Record<string, string | undefined> => ({
  left: `${at.left}px`,
  width: `${at.width}px`,
  "max-height": `${at.maxHeight}px`,
  bottom: at.side === "bottom" ? `${at.offset}px` : undefined,
  top: at.side === "top" ? `${at.offset}px` : undefined,
})

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
