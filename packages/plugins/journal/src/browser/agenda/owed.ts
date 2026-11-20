import type { Owed } from "@olai/format"

import { CHIP_ALARM, CHIP_QUIET } from "olai-plugin-layout/chip"

export type Face = "overdue" | "today" | "quiet"

type Painted = Exclude<Face, "quiet">

declare const snapshot: unique symbol

export type Snapshot = Owed & { readonly [snapshot]: true }

declare const positive: unique symbol

type Count = number & { readonly [positive]: true }

export interface Mark {
  readonly face: Face
  readonly owed: Snapshot
  readonly count: number
  readonly entry: string
  readonly chip: string
  readonly dot: string
  readonly said: string | undefined
}

const PAINT: Record<Painted, { readonly entry: string; readonly chip: string; readonly dot: string }> = {
  overdue: {
    entry: "font-medium text-alarm",
    chip: CHIP_ALARM,
    dot: "bg-alarm",
  },
  today: {
    entry: "",
    chip: CHIP_QUIET,
    dot: "border border-muted bg-transparent",
  },
}

const QUIET = { face: "quiet", count: 0, entry: "", chip: "", dot: "", said: undefined } as const

export const ROW_DOT: { readonly overdue: string; readonly today: string } = {
  overdue: PAINT.overdue.dot,
  today: PAINT.today.dot,
}

const counting = (count: number): Count | undefined => count > 0 ? count as Count : undefined

const paintOf = (face: Painted, count: Count, owed: Owed) => ({
  face,
  count,
  ...PAINT[face],
  said: `Agenda — ${phraseOf(owed)}`,
})

const snapshotOf = (counted: Owed | undefined): Snapshot =>
  Object.freeze({ overdue: counted?.overdue ?? 0, today: counted?.today ?? 0 }) as Snapshot

export const markOf = (counted: Owed | undefined): Mark => {
  const owed = snapshotOf(counted)
  const late = counting(owed.overdue)
  if (late !== undefined) return { owed, ...paintOf("overdue", late, owed) }
  const due = counting(owed.today)
  if (due !== undefined) return { owed, ...paintOf("today", due, owed) }
  return { owed, ...QUIET }
}

export const unchanged = (before: Mark, after: Mark): boolean =>
  before.owed.overdue === after.owed.overdue && before.owed.today === after.owed.today

export const phraseOf = (owed: Owed): string => {
  const late = owed.overdue > 0 ? [`${owed.overdue} overdue`] : []
  const on = owed.today > 0 ? [`${owed.today} due today`] : []
  return [...late, ...on].join(", ")
}
