/**
 * THE BAR'S ONE HEALTH DOT, as arithmetic: which tone it wears and what it
 * says, from the statuses standing in the bar right now.
 *
 * Pure, so the interesting cases — a connection that dropped while git has
 * writes waiting, a plugin with no opinion, nothing but quiet rows — are a
 * table rather than a browser session. `./Health.tsx` draws it.
 *
 * WHO SAYS WHAT is not decided here. Each readout states its own tone and its
 * own words (`./slots.ts`'s `BarStatus`, supplied by the plugin that owns the
 * readout, and the connection's `lookOf`) — the same value its row paints
 * from. This file only picks the worst and says it, so the dot's colour is
 * always some row's.
 */
import type { BarStatus, BarTone } from "./slots.ts"

/** The dot's three colours. `quiet` never reaches the dot: a row with nothing
 *  running is not a row with something wrong. */
export type DotTone = Exclude<BarTone, "quiet">

const RANK: Readonly<Record<BarTone, number>> = { quiet: 0, healthy: 0, notice: 1, alarm: 2 }

/** The worst tone among `statuses`, folded onto the dot's three. An empty bar
 *  is healthy: absence is absence, not a problem. */
export const worstOf = (statuses: ReadonlyArray<BarStatus>): DotTone =>
  statuses.reduce<DotTone>((worst, one) => {
    const tone: DotTone = one.tone === "quiet" ? "healthy" : one.tone
    return RANK[tone] > RANK[worst] ? tone : worst
  }, "healthy")

/** The statuses that are news — `alarm` first, then `notice` — in the order
 *  they stand in the bar within each tone. */
export const newsOf = (statuses: ReadonlyArray<BarStatus>): ReadonlyArray<BarStatus> => [
  ...statuses.filter((one) => one.tone === "alarm"),
  ...statuses.filter((one) => one.tone === "notice"),
]

/** What the dot is called: its accessible name, and the first line of its tip.
 *  Healthy says so in two words; anything else names each piece of news in the
 *  readout's own label, so a dropped connection is heard without opening the
 *  popover. */
export const nameOf = (statuses: ReadonlyArray<BarStatus>): string => {
  const news = newsOf(statuses)
  return news.length === 0 ? "Status: all good" : `Status: ${news.map((one) => one.label).join(" · ")}`
}

/** The tip: the name, and under it each piece of news's own sentence. */
export const tipOf = (statuses: ReadonlyArray<BarStatus>): string => {
  const news = newsOf(statuses)
  return [nameOf(statuses), ...news.flatMap((one) =>
    one.detail === undefined || one.detail === "" ? [] : [`${one.label} — ${one.detail}`])].join("\n")
}
