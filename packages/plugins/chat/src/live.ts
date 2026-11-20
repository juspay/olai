import { type ChatLocalState, word } from "./local.ts"
import { MemoryFailure } from "@kolu/acp-client"
import { Effect } from "effect"

const LIVE = "live"

export const RECORDED = 8

export interface LiveMark {
  readonly node: string
  readonly touched: number
}

export interface LiveRecord {
  readonly read: () => ReadonlyArray<LiveMark>
  readonly write: (rows: ReadonlyArray<LiveMark>) => Effect.Effect<void, MemoryFailure>
}

const read = (held: Record<string, unknown>): ReadonlyArray<LiveMark> => {
  const rows = held["live"]
  if (!Array.isArray(rows)) return []
  return rows.flatMap((one) => {
    if (one === null || typeof one !== "object") return []
    const row = one as Record<string, unknown>
    const node = word(row["node"])
    const touched = word(row["touched"])
    const at = touched === null ? Number.NaN : Date.parse(touched)
    if (node === null || Number.isNaN(at)) return []
    return [{ node, touched: at }]
  })
}

export const marksOf = (
  live: ReadonlyArray<{ readonly node: string; readonly touched: number }>,
  waiting: ReadonlyArray<{ readonly node: string; readonly touched: number }> = [],
): ReadonlyArray<LiveMark> => {
  const held = new Map<string, number>()
  for (const row of waiting) held.set(row.node, row.touched)
  for (const row of live) held.set(row.node, row.touched)
  return [...held]
    .filter(([, touched]) => !Number.isNaN(touched))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, RECORDED)
    .map(([node, touched]) => ({ node, touched }))
}

export const forLocalState = (local: ChatLocalState): LiveRecord => {
  const held = local.load(LIVE)
  let rows = held === null ? [] : read(held)
  return {
    read: () => rows,
    write: (next) =>
      Effect.gen(function*() {
        const table = marksOf(next)
        yield* local.save(LIVE, {
          live: table.map((row) => ({ node: row.node, touched: new Date(row.touched).toISOString() })),
        })
        rows = table
      }),
  }
}
