import type { ChatEntry } from "olai-plugin-chat/wire"
export const filedUnder = (entry: ChatEntry | undefined): string | null =>
  entry?.kind === "tool" ? entry.parent ?? null : null

export const asksInAForm = (entry: ChatEntry | undefined): boolean =>
  entry?.kind === "tool" && entry.asksThroughForm === true

export interface Lane {
  readonly parent: string
  readonly label: string | null
}

export const laneOf = (
  row: ChatEntry | undefined,
  above: ChatEntry | undefined,
  nameOf: (key: string) => string | undefined,
): Lane | null => {
  if (row === undefined) return null
  if (row.kind !== "tool" && row.kind !== "ask") return null
  const parent = row.parent
  if (parent === undefined) return null
  return { parent, label: owedAName(row, above) ? nameOf(parent) ?? SOMEBODY : null }
}

const owedAName = (row: ChatEntry, above: ChatEntry | undefined): boolean =>
  namesItself(row) || !established(row, above)

const parentOf = (row: ChatEntry | undefined): string | undefined =>
  row?.kind === "tool" || row?.kind === "ask" ? row.parent : undefined

const established = (row: ChatEntry, above: ChatEntry | undefined): boolean =>
  above?.id === parentOf(row) || parentOf(above) === parentOf(row)

const namesItself = (row: ChatEntry): boolean => row.kind === "ask"

const SOMEBODY = "A subagent"

export const RAIL = "border-l-2 border-muted/60 pl-2"
