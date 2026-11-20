export type Axis = "row" | "col"

export const PANE_MIN_PX = 180
export const PANE_RAIL_PX = 36

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
