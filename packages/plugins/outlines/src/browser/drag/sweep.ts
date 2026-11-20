import type { Line } from "./lines.ts"

export interface Run {
  readonly keys: ReadonlyArray<string>
  readonly from: string
  readonly to: string
}

export interface Sweep {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly width: number
  readonly run: Run | null
}

export const planSweep = (
  rows: ReadonlyArray<Line>,
  fromY: number,
  toY: number,
): Sweep | null => {
  if (rows.length === 0) return null
  const top = Math.min(fromY, toY)
  const bottom = Math.max(fromY, toY)
  const keys: Array<string> = []
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
    : toY >= fromY
    ? { from: first, to: last }
    : { from: last, to: first }
  return {
    top,
    bottom,
    left,
    width: right - left,
    run: ends === null ? null : { keys, from: ends.from, to: ends.to },
  }
}
