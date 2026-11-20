import type { BarStatus, BarTone } from "./slots.ts"

export type DotTone = Exclude<BarTone, "quiet">

const RANK: Readonly<Record<BarTone, number>> = { quiet: 0, healthy: 0, notice: 1, alarm: 2 }

export const worstOf = (statuses: ReadonlyArray<BarStatus>): DotTone =>
  statuses.reduce<DotTone>((worst, one) => {
    const tone: DotTone = one.tone === "quiet" ? "healthy" : one.tone
    return RANK[tone] > RANK[worst] ? tone : worst
  }, "healthy")

const PLACE: Readonly<Record<BarTone, number>> = { alarm: 0, notice: 1, healthy: 2, quiet: 3 }

/** Rows of one tone keep the order they came in (the connection first, then
 *  mount order): the sort is stable. */
export const worstFirst = <T>(rows: ReadonlyArray<T>, toneOf: (row: T) => BarTone): ReadonlyArray<T> =>
  [...rows].sort((a, b) => PLACE[toneOf(a)] - PLACE[toneOf(b)])

export const newsOf = (statuses: ReadonlyArray<BarStatus>): ReadonlyArray<BarStatus> => [
  ...statuses.filter((one) => one.tone === "alarm"),
  ...statuses.filter((one) => one.tone === "notice"),
]

export const nameOf = (statuses: ReadonlyArray<BarStatus>): string => {
  const news = newsOf(statuses)
  return news.length === 0 ? "Status: all good" : `Status: ${news.map((one) => one.label).join(" · ")}`
}

export const tipOf = (statuses: ReadonlyArray<BarStatus>): string => {
  const news = newsOf(statuses)
  return [nameOf(statuses), ...news.flatMap((one) =>
    one.detail === undefined || one.detail === "" ? [] : [`${one.label} — ${one.detail}`])].join("\n")
}
