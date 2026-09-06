/**
 * Pure geometry for a split: the minimum before a child becomes a
 * rail, the rail's own size, and how a pointer delta along an axis
 * redistributes two siblings.
 *
 * Parameterized by axis only where the arithmetic is free: the caller
 * hands the delta and the extent (dx + width for a row, dy + height
 * for a column). This file does not know about the URL, the router,
 * or which projection is on screen.
 */

/** Which way a split faces. `row` is children side by side (today);
 *  `col` is children stacked (a future PR's projection). */
export type Axis = "row" | "col"

/** Below this, along the split's extent, a child becomes a rail. */
export const PANE_MIN_PX = 180
/** The rail's own size on that same axis. */
export const PANE_RAIL_PX = 36

/**
 * Redistribute two siblings given a pointer travel along the split.
 *
 * `along` is the signed delta on the axis (right/down is positive).
 * `size` is the split's extent in the same unit. A child that would
 * land below {@link PANE_MIN_PX} collapses to `0` — collapse, not
 * close. The other child's share absorbs what it dropped.
 */
export const snap = (
  start: ReadonlyArray<number>,
  along: number,
  size: number,
  left: number,
  right: number,
  minPx: number = PANE_MIN_PX,
): number[] => {
  if (size <= 0) return [...start]
  const frac = along / size
  const next = [...start]
  const a = Math.max(0, (start[left] ?? 0) + frac)
  const b = Math.max(0, (start[right] ?? 0) - frac)
  next[left] = a
  next[right] = b
  const aPx = a * size
  const bPx = b * size
  if (aPx < minPx && aPx < bPx) next[left] = 0
  if (bPx < minPx && bPx <= aPx) next[right] = 0
  return next
}
