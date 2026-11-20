import type { Lit } from "@olai/format"

export const HIT_CLASS = "olai-hit"

export interface Run {
  readonly text: string
  readonly lit: boolean
}

export const runsIn = (
  text: string,
  landings: ReadonlyArray<Lit>,
  from = 0,
  to = text.length,
): ReadonlyArray<Run> => {
  const runs: Array<Run> = []
  let at = from
  for (const landing of landings) {
    if (landing.end <= from) continue
    if (landing.at >= to) break
    const start = Math.max(landing.at, from)
    const end = Math.min(landing.end, to)
    if (start > at) runs.push({ text: text.slice(at, start), lit: false })
    runs.push({ text: text.slice(start, end), lit: true })
    at = end
  }
  if (at < to || runs.length === 0) runs.push({ text: text.slice(at, to), lit: false })
  return runs
}

export const NO_NEEDLES: ReadonlyArray<string> = []
