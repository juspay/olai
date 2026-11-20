import type { Owed } from "@olai/format"

import { CHIP_ALARM, CHIP_QUIET } from "olai-plugin-layout/chip"

export type Face = "overdue" | "today" | "quiet"

export interface Mark {
  readonly face: Face
  readonly owed: Owed
  readonly count: number
  readonly entry: string
  readonly chip: string
  readonly dot: string
  readonly said: string | undefined
}

const PAINT: Record<Face, { readonly entry: string; readonly chip: string; readonly dot: string }> = {
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
  quiet: { entry: "", chip: "", dot: "" },
}

export const ROW_DOT: { readonly overdue: string; readonly today: string } = {
  overdue: PAINT.overdue.dot,
  today: PAINT.today.dot,
}

/**
 * IT COPIES THE TWO NUMBERS because a MARK IS A VALUE about one moment —
 * {@link unchanged} compares one against another, so it cannot be two readings
 * of an object something else is free to move.
 *
 * PAINTED FACE ⟹ COUNT > 0. The quiet face is the only zero and its chip is
 * empty, which is the invariant `../layout/CountChip.tsx` hides at zero on.
 */
export const markOf = (counted: Owed | undefined): Mark => {
  const owed: Owed = { overdue: counted?.overdue ?? 0, today: counted?.today ?? 0 }
  const face: Face = owed.overdue > 0 ? "overdue" : owed.today > 0 ? "today" : "quiet"
  return {
    face,
    owed,
    count: face === "overdue" ? owed.overdue : owed.today,
    ...PAINT[face],
    said: face === "quiet" ? undefined : `Agenda — ${phraseOf(owed)}`,
  }
}

/** WHICH IS ONLY TRUE BECAUSE {@link markOf} COPIED THEM: comparing fields of
 *  a value something else keeps mutating in place would report "nothing
 *  changed" forever. */
export const unchanged = (before: Mark, after: Mark): boolean =>
  before.owed.overdue === after.owed.overdue && before.owed.today === after.owed.today

export const phraseOf = (owed: Owed): string => {
  const late = owed.overdue > 0 ? [`${owed.overdue} overdue`] : []
  const on = owed.today > 0 ? [`${owed.today} due today`] : []
  return [...late, ...on].join(", ")
}
