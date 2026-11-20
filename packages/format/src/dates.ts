import { mintExt } from "./kinds.ts"
import type { Claims } from "./kinds.ts"
import { Order, Schema } from "effect"

import { dayAt, type Derived, Situated, situate } from "./derive.ts"
import { fileKind, stemOf } from "./kinds.ts"
import type { LocatedRegular } from "./node.ts"
import { type Dated, monthOf, Occasioned } from "./occasion.ts"
import { byPath } from "./paths.ts"

export const datedDays = (
  derived: Derived,
  month: string,
): ReadonlyArray<string> => {
  const days: Array<string> = []
  for (let at = dayAt(derived.days, month); at < derived.days.length; at++) {
    const day = derived.days[at] as string
    if (monthOf(day) > month) break
    days.push(day)
  }
  return days
}

export const DatedRequest = Schema.Struct({
  month: Schema.String,
})
export type DatedRequest = typeof DatedRequest.Type

export const DatedAnswer = Schema.Struct({
  days: Schema.Array(Schema.String),
})
export type DatedAnswer = typeof DatedAnswer.Type

export const sameDated: (a: DatedAnswer, b: DatedAnswer) => boolean = Schema
  .toEquivalence(DatedAnswer)

export const datedAnswer = (derived: Derived, month: string): DatedAnswer => ({
  days: datedDays(derived, month),
})

export const DayEntry = Schema.Struct({ ...Situated.fields, ...Occasioned.fields })
export type DayEntry = typeof DayEntry.Type

export const DayGroup = Schema.Struct({
  file: Schema.String,
  nodes: Schema.Array(DayEntry),
})
export type DayGroup = typeof DayGroup.Type

export const datedOn = (derived: Derived, day: string): ReadonlyArray<DayGroup> =>
  groupedOn(derived, derived.byDay.get(day) ?? [])

export const groupedOn = (
  derived: Derived,
  dated: ReadonlyArray<Dated>,
): ReadonlyArray<DayGroup> => {
  const placed = new Set<LocatedRegular>()
  const entries: Array<DayEntry> = []
  const counted = new Map<string, number>()
  for (const one of dated) {
    if (placed.has(one.at)) continue
    placed.add(one.at)
    entries.push(entryOf(derived, one, counted))
  }
  return byOutline(entries)
}

export const entryOf = (
  derived: Derived,
  dated: Dated,
  counted?: Map<string, number>,
): DayEntry => ({
  ...situate(derived, dated.at, counted),
  occasion: dated.occasion,
  date: dated.date,
})

export const byOutline = (
  entries: ReadonlyArray<DayEntry>,
): ReadonlyArray<DayGroup> => {
  const byFile = new Map<string, Array<DayEntry>>()
  for (const entry of entries) {
    const group = byFile.get(entry.shows.file)
    if (group === undefined) byFile.set(entry.shows.file, [entry])
    else group.push(entry)
  }

  return [...byFile.entries()]
    .sort(([left], [right]) => byPath(left, right))
    .map(([file, nodes]) => ({ file, nodes: nodes.sort(byEntryTime) }))
}

export const datedIn = (groups: ReadonlyArray<DayGroup>): number =>
  groups.reduce((total, group) => total + group.nodes.length, 0)

const byEntryTime = (left: DayEntry, right: DayEntry): number =>
  byDateThenLine(left.date, left.shows.line, right.date, right.shows.line)

const byDateThenLine = (leftDate: string, leftLine: number, rightDate: string, rightLine: number): number =>
  leftDate === rightDate
    ? leftLine - rightLine
    : Order.String(leftDate, rightDate)

export const byDrawOrder = (left: Dated, right: Dated): number => {
  const file = byPath(left.at.file, right.at.file)
  return file === 0
    ? byDateThenLine(left.date, left.at.line, right.date, right.at.line)
    : file
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export const noteDateOf = (claims: Claims, file: string): string | null => {
  const kind = fileKind(claims, file)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  if (claim?.holds !== "text" || !claim.kept) return null
  const stem = stemOf(claims, file)
  return ISO_DAY.test(stem) ? stem : null
}

export const dailyNotesOn = (
  claims: Claims,
  documents: ReadonlyArray<string>,
  day: string,
): ReadonlyArray<string> =>
  documents.filter((file) => noteDateOf(claims, file) === day).sort(byPath)

export const dailyNoteDays = (
  claims: Claims,
  documents: ReadonlyArray<string>,
  month: string,
): ReadonlySet<string> => {
  const days = new Set<string>()
  for (const file of documents) {
    const day = noteDateOf(claims, file)
    if (day !== null && monthOf(day) === month) days.add(day)
  }
  return days
}

export const isDay = (value: string): boolean => ISO_DAY.test(value)

export const dailyNotePathFor = (
  claims: Claims,
  documents: ReadonlyArray<string>,
  day: string,
): string | null => {
  const ext = mintExt(claims, "markdown")
  if (ext === null) return null
  const name = `${day}${ext}`

  let example: { readonly file: string; readonly date: string } | null = null
  for (const file of documents) {
    const date = noteDateOf(claims, file)
    if (date === null) continue
    if (
      example === null || date > example.date ||
      (date === example.date && byPath(file, example.file) < 0)
    ) {
      example = { file, date }
    }
  }
  if (example === null) return name

  const from = {
    year: example.date.slice(0, 4),
    month: example.date.slice(5, 7),
    day: example.date.slice(8, 10),
  }
  const to = { year: day.slice(0, 4), month: day.slice(5, 7), day: day.slice(8, 10) }

  const respelled = (segment: string): string =>
    segment === `${from.year}-${from.month}-${from.day}`
      ? `${to.year}-${to.month}-${to.day}`
      : segment === `${from.year}-${from.month}`
      ? `${to.year}-${to.month}`
      : segment === from.year
      ? to.year
      : segment === from.month
      ? to.month
      : segment === from.day
      ? to.day
      : segment

  const directory = example.file.split("/").slice(0, -1).map(respelled)
  return [...directory, name].join("/")
}
