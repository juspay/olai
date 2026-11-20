import { type Row, shownRecord } from "@olai/format"

import { type Fold, foldOf } from "./rows.ts"

const chainTo = (
  rows: ReadonlyArray<Row>,
  id: string,
): ReadonlyArray<Row> | undefined => {
  const descend = (row: Row, at: ReadonlyArray<Row>): ReadonlyArray<Row> | undefined => {
    const chain = [...at, row]
    if (answer(row, id)) return chain
    for (const child of row.children) {
      const down = descend(child, chain)
      if (down !== undefined) return down
    }
    return undefined
  }
  for (const row of rows) {
    const found = descend(row, [])
    if (found !== undefined) return found
  }
  return undefined
}

const answer = (row: Row, id: string): boolean =>
  shownRecord(row).node.id === id ||
  (row.kind === "mirror" && row.at.node.id === id)

export const aim = (
  rows: ReadonlyArray<Row>,
  id: string,
  named: (asked: string) => string | null | undefined,
  whole?: ReadonlyArray<Row>,
): Aim => {
  const chain = chainTo(rows, id)
  if (chain !== undefined) return { kind: "chain", chain }
  const target = named(id)
  if (target === undefined) return { kind: "ask" }
  const settled = (pool: ReadonlyArray<Row>): ReadonlyArray<Row> | undefined =>
    target === null ? undefined : chainTo(pool, target)
  const resolved = settled(rows)
  if (resolved !== undefined) return { kind: "chain", chain: resolved }
  if (whole !== undefined) {
    const hidden = chainTo(whole, id) ?? settled(whole)
    if (hidden !== undefined) return { kind: "reveal", chain: hidden }
  }
  return { kind: "miss", target }
}

export type Aim =
  | { readonly kind: "chain"; readonly chain: ReadonlyArray<Row> }
  | { readonly kind: "ask" }
  | { readonly kind: "reveal"; readonly chain: ReadonlyArray<Row> }
  | { readonly kind: "miss"; readonly target: string | null }

export const missedSays = (id: string, target: string | null): string =>
  target === null
    ? `${id} — not found`
    : `${id} — not shown on this page`

export const failedSays = (id: string): string =>
  `${id} — couldn’t look this up. Try again.`

export const shutAlong = (
  chain: ReadonlyArray<Row>,
  folded: ReadonlySet<string>,
): ReadonlyArray<Fold> => {
  const seen = new Set<string>()
  const out: Fold[] = []
  for (const row of chain.slice(0, -1)) {
    const fold = foldOf(row)
    if (!folded.has(fold.id) || seen.has(fold.id)) continue
    seen.add(fold.id)
    out.push(fold)
  }
  return out
}
