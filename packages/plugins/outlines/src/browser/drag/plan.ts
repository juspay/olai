import type { Line } from "./lines.ts"

export interface Placed extends Line {
  readonly id: string
  readonly parent: string | null
  readonly into: string | null
  readonly depth: number
}

export interface Landing {
  readonly parent: string | null
  readonly after: string | null
  readonly top: number
  readonly left: number
  readonly width: number
  readonly depth: number
}

interface Drop {
  readonly parent: string | null
  readonly after: string | null
  readonly gap: number
  readonly depth: number
}

const indentOf = (rows: ReadonlyArray<Placed>): number | null => {
  const first = rows[0]
  if (first === undefined) return null
  for (const row of rows) {
    if (row.depth === first.depth) continue
    return Math.abs(row.left - first.left) / Math.abs(row.depth - first.depth)
  }
  return null
}

const FALLBACK_INDENT = 32

const gapAt = (rows: ReadonlyArray<Placed>, y: number): number =>
  rows.filter((row) => y > (row.top + row.bottom) / 2).length

const depthsAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
): { readonly min: number; readonly max: number } => {
  const above = rows[gap - 1]
  const below = rows[gap]
  const max = above === undefined
    ? below?.depth ?? 0
    : above.depth + (above.into === null ? 0 : 1)
  const min = below?.depth ?? 0
  return { min: Math.min(min, max), max }
}

const depthAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
  x: number,
  indent: number,
): number => {
  const { min, max } = depthsAt(rows, gap)
  const first = rows[0]
  if (first === undefined) return min
  const origin = first.left - first.depth * indent
  const asked = Math.round((x - origin) / indent)
  return Math.min(max, Math.max(min, asked))
}

const dropAt = (
  rows: ReadonlyArray<Placed>,
  gap: number,
  depth: number,
): Drop | null => {
  const above = rows[gap - 1]
  if (above === undefined) {
    const below = rows[gap]
    return below === undefined
      ? null
      : { parent: below.parent, after: null, gap, depth: below.depth }
  }
  if (depth > above.depth && above.into !== null) {
    return { parent: above.into, after: null, gap, depth: above.depth + 1 }
  }
  for (let at = gap - 1; at >= 0; at--) {
    const row = rows[at]
    if (row !== undefined && row.depth === depth) {
      return { parent: row.parent, after: row.id, gap, depth }
    }
  }
  return null
}

export const planDrop = (
  rows: ReadonlyArray<Placed>,
  x: number,
  y: number,
): Landing | null => {
  const gap = gapAt(rows, y)
  const indent = indentOf(rows) ?? FALLBACK_INDENT
  const drop = dropAt(rows, gap, depthAt(rows, gap, x, indent))
  if (drop === null) return null
  const above = rows[drop.gap - 1]
  const beside = above ?? rows[drop.gap]
  const edge = above?.bottom ?? rows[drop.gap]?.top
  if (beside === undefined || edge === undefined) return null
  const left = beside.left - beside.depth * indent + drop.depth * indent
  return {
    parent: drop.parent,
    after: drop.after,
    depth: drop.depth,
    top: edge,
    left,
    width: Math.max(0, beside.right - left),
  }
}
