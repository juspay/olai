import { type Accessor, createMemo } from "solid-js"

import { dailyNoteDays } from "@olai/format"
import type { OwedReading, OwedRequest } from "@olai/format"

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

const askFor = (today: string | undefined): OwedRequest | null =>
  today === undefined ? null : { today, cap: OWED_ROWS }

export const createOwed = (
  today: Accessor<string | undefined>,
): Accessor<OwedReading | undefined> => {
  const answer = journalWire().streams.owed.use(() => askFor(today()))
  return createMemo(() => {
    const owed = answer()
    return owed === undefined ? undefined : {
      overdue: owed.overdue,
      today: owed.today,
      rows: owed.rows.map((row) => ({ ...row })),
    }
  })
}
