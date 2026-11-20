import { litBy } from "@olai/format"

import { type Run, runsIn } from "@olai/markdown-ui/lit.ts"

const WIDTH = 140

const LEAD = 40

const ELLIPSIS = "…"

export const excerptOf = (
  desc: string,
  needles: ReadonlyArray<string>,
): ReadonlyArray<Run> | undefined => {
  const hits = litBy(desc, needles)
  const first = hits[0]
  if (first === undefined) return undefined
  const opens = lineStart(desc, first.at)
  const from = wordEdge(desc, Math.max(opens, first.at - LEAD), opens)
  const to = Math.min(desc.length, Math.max(from + WIDTH, first.end))
  const runs: ReadonlyArray<Run> = runsIn(desc, hits, from, to)
    .map((run) => ({ text: oneLine(run.text), lit: run.lit }))
  const opened = from > 0 ? [{ text: ELLIPSIS, lit: false }, ...runs] : runs
  return to < desc.length ? [...opened, { text: ELLIPSIS, lit: false }] : opened
}

const lineStart = (desc: string, at: number): number =>
  desc.lastIndexOf("\n", at) + 1

const wordEdge = (desc: string, at: number, floor: number): number => {
  if (at <= floor) return floor
  const space = desc.lastIndexOf(" ", at)
  return space < floor || at - space > LEAD ? at : space + 1
}

const oneLine = (text: string): string => text.replace(/\s+/g, " ")
