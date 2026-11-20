import { type Accessor, createMemo } from "solid-js"

import { dailyNoteDays } from "@olai/format"
import type { OwedReading } from "@olai/format"

import { useServed, servedDirectory } from "./vault.ts"
import { journalWire } from "./wire.ts"

export const createDated = (month: Accessor<string>): Accessor<ReadonlySet<string>> => {
  const answer = journalWire().streams.dated.use(() => ({ month: month() }))
  return createMemo(() => new Set(answer()?.days ?? []))
}

export const createNoted = (month: Accessor<string>): Accessor<ReadonlySet<string>> => {
  const paths = useServed()
  return createMemo(() => {
    const files = servedDirectory()
    return files === undefined ? new Set<string>() : dailyNoteDays(files.claims(), paths(), month())
  }, undefined, { equals: (a, b) => a.size === b.size && [...a].every(day => b.has(day)) })
}

const OWED_ROWS = 5

/**
 * The `undefined` is load-bearing and is passed straight through to the mark
 * (`./agenda/owed.ts`, which draws NOTHING rather than a zero).
 *
 * AND `undefined` FOR TODAY IS "DO NOT ASK YET".
 */
export const createOwed = (
  /** A signal or memo, not a fresh value per read: the subscription re-opens
   *  whenever this NOTIFIES, so a caller handing over an untracked
   *  recomputation would tear the stream down and reset the badge on frames
   *  that changed nothing. */
  today: Accessor<string | undefined>,
): Accessor<OwedReading | undefined> => {
  const answer = journalWire().streams.owed.use(() => {
    const day = today()
    return day === undefined ? null : { today: day, cap: OWED_ROWS }
  })
  return createMemo(() => {
    const owed = answer()
    return owed === undefined ? undefined : {
      overdue: owed.overdue,
      today: owed.today,
      rows: owed.rows.map((row) => ({ ...row })),
    }
  })
}
