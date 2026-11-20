import { AWAKE, awake, type Row } from "./roster.ts"

const instant = (value: string | undefined): number => {
  const parsed = Date.parse(value ?? "")
  return Number.isNaN(parsed) ? -Infinity : parsed
}
export const newestFirst = (a: string | undefined, b: string | undefined): number =>
  instant(b) - instant(a) || 0

const byLatest = (a: Row, b: Row): number =>
  a.said !== null && b.said !== null ? newestFirst(a.said.at, b.said.at)
    : a.said !== null ? -1 : b.said !== null ? 1
    : newestFirst(a.changed, b.changed)

const band = (row: Row): number => awake(row.standing) ? AWAKE.indexOf(row.standing) : AWAKE.length

export const byActivity = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  rows.toSorted((a, b) => band(a) - band(b) || byLatest(a, b))
