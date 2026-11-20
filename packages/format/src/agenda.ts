import { Schema } from "effect"

import { daysBetween, MONTHS, WEEKDAYS, weekdayOf } from "./calendar.ts"

import { byDrawOrder, datedIn, DayGroup, groupedOn } from "./dates.ts"
import { dayAt, type Derived, unfinishedWork } from "./derive.ts"
import { keepingDated, type Selected } from "./filter.ts"
import { type RegularNode, Status } from "./node.ts"
import { type Dated, dayOf, timeOf } from "./occasion.ts"

export const isOverdue = (node: RegularNode, today: string): boolean => {
  if (node.date === undefined) return false
  return unfinishedWork(node) && dayOf(node.date) < dayOf(today)
}

export const AgendaDay = Schema.Struct({
  date: Schema.String,
  groups: Schema.Array(DayGroup),
})
export type AgendaDay = typeof AgendaDay.Type

export const Agenda = Schema.Struct({
  overdue: Schema.Array(AgendaDay),
  today: Schema.Array(DayGroup),
  upcoming: Schema.Array(AgendaDay),
})
export type Agenda = typeof Agenda.Type

export const UPCOMING_DAYS = 7

export const agendaOf = (derived: Derived, today: string): Agenda => ({
  overdue: behind(derived, today),
  // TODAY'S BUCKET IS ASKED FOR BY THE VALUE THE CALLER HANDED OVER, which is
  // what the bucketed walk this replaced did (`days.get(today)`) and is
  // deliberately not `dayOf(today)`. Normalising it here would be a performance
  // change quietly giving a different answer to a question, which is the one
  // thing this diff may not do.
  today: owedOn(derived, derived.byDay.get(today) ?? []),
  upcoming: aheadOf(derived, today),
})

export const nothingDue = (agenda: Agenda): boolean =>
  agenda.overdue.length === 0 &&
  agenda.today.length === 0 &&
  agenda.upcoming.length === 0

export const Owed = Schema.Struct({
  overdue: Schema.Number,
  today: Schema.Number,
})
export type Owed = typeof Owed.Type

export const OwedRow = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
  title: Schema.String,
  date: Schema.String,
  status: Schema.optional(Status),
})
export type OwedRow = typeof OwedRow.Type

export const OwedReading = Schema.Struct({
  ...Owed.fields,
  rows: Schema.Array(OwedRow),
})
export type OwedReading = typeof OwedReading.Type

export const OwedRequest = Schema.Struct({
  today: Schema.String,
  cap: Schema.Int,
})
export type OwedRequest = typeof OwedRequest.Type

export const sameOwedReading: (a: OwedReading, b: OwedReading) => boolean = Schema.toEquivalence(OwedReading)

export const owedOf = (agenda: Agenda): Owed => ({
  overdue: datedInDays(agenda.overdue),
  today: datedIn(agenda.today),
})

export const owedNow = (derived: Derived, today: string): Owed => {
  const now = dayOf(today)
  let overdue = 0
  for (const [date, owed] of derived.owedByDay) {
    if (date >= now) break
    overdue += owed
  }
  return { overdue, today: derived.owedByDay.get(today) ?? 0 }
}

export const owedRows = (
  derived: Derived,
  today: string,
  cap: number,
): ReadonlyArray<OwedRow> => {
  const rows: Array<OwedRow> = []
  const want = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0
  if (want === 0) return rows
  const take = (date: string, own: ReadonlyArray<Dated> | undefined): boolean => {
    if (own === undefined) return false
    const owed: Array<Dated> = []
    for (const one of own) {
      if (unfinishedWork(one.at.node)) owed.push(one)
    }
    owed.sort(byDrawOrder)
    for (const one of owed) {
      if (rows.length >= want) return true
      const status = derived.status.get(one.at.node.id)
      rows.push({
        id: one.at.node.id,
        file: one.at.file,
        title: one.at.node.title,
        date: one.date,
        ...(status === undefined ? {} : { status }),
      })
    }
    return rows.length >= want
  }
  const now = dayOf(today)
  for (const date of derived.owedByDay.keys()) {
    if (date >= now) break
    if (take(date, derived.byDay.get(date))) return rows
  }
  take(today, derived.byDay.get(today))
  return rows
}

export const owedReading = (
  derived: Derived,
  today: string,
  cap: number,
): OwedReading => ({
  ...owedNow(derived, today),
  rows: owedRows(derived, today, cap),
})

export const owedMore = (reading: OwedReading): number =>
  reading.overdue + reading.today - reading.rows.length

export const keepingOwed = (
  agenda: Agenda,
  matched: Selected,
): Agenda => ({
  overdue: keepingDays(agenda.overdue, matched),
  today: keepingDated(agenda.today, matched),
  upcoming: keepingDays(agenda.upcoming, matched),
})

const keepingDays = (
  days: ReadonlyArray<AgendaDay>,
  matched: Selected,
): ReadonlyArray<AgendaDay> =>
  days.flatMap((day) => {
    const groups = keepingDated(day.groups, matched)
    return groups.length === 0 ? [] : [{ ...day, groups }]
  })

export const owedIn = (agenda: Agenda): number =>
  datedInDays(agenda.overdue) + datedIn(agenda.today) +
  datedInDays(agenda.upcoming)

const datedInDays = (days: ReadonlyArray<AgendaDay>): number =>
  days.reduce((total, day) => total + datedIn(day.groups), 0)

const behind = (
  derived: Derived,
  today: string,
): ReadonlyArray<AgendaDay> => {
  const gone: Array<AgendaDay> = []
  const now = dayOf(today)
  for (const date of derived.owedByDay.keys()) {
    if (date >= now) break
    // NOT `?? []`: a key of `owedByDay` is a key of `byDay` by construction.
    const groups = owedOn(derived, derived.byDay.get(date) as ReadonlyArray<Dated>)
    if (groups.length > 0) gone.push({ date, groups })
  }
  return gone
}

const owedOn = (
  derived: Derived,
  dated: ReadonlyArray<Dated>,
): ReadonlyArray<DayGroup> =>
  groupedOn(derived, dated.filter((one) => unfinishedWork(one.at.node)))

const aheadOf = (
  derived: Derived,
  today: string,
): ReadonlyArray<AgendaDay> => {
  const ahead: Array<AgendaDay> = []
  for (let at = dayAt(derived.days, today); at < derived.days.length; at++) {
    const date = derived.days[at] as string
    if (date <= today) continue
    if (ahead.length === UPCOMING_DAYS) break
    const groups = owedOn(derived, derived.byDay.get(date) as ReadonlyArray<Dated>)
    if (groups.length > 0) ahead.push({ date, groups })
  }
  return ahead
}

export type Standing = "late" | "today" | "ahead"

export type Tone = "alarm" | "accent" | "ink" | "muted" | "rule"

export interface Felt {
  readonly standing: Standing
  readonly days: number | undefined
  readonly calendar: string
  readonly distance: string | undefined
  readonly fade: number
  readonly tone: Tone
}

const FURTHEST = 0.5

const NEAR = 7

const FAR = 56

const ROLLOFF = 5

export const feltOn = (date: string, today: string): Felt => {
  const day = dayOf(date)
  const now = dayOf(today)
  const standing: Standing = day < now ? "late" : day > now ? "ahead" : "today"
  const days = daysBetween(now, day) ?? undefined
  return {
    standing,
    days,
    calendar: calendarOf(day),
    distance: days === undefined ? undefined : distanceOf(standing, days),
    fade: days === undefined ? 1 : fadeOf(standing, days),
    tone: days === undefined ? toneOf(standing, 0) : toneOf(standing, days),
  }
}

export const owedFact = (
  date: string,
  overdue: boolean,
  felt: Felt,
): string | undefined => {
  if (!overdue) return timeOf(date)
  return felt.days === undefined ? undefined : lateness(felt.days)
}

const lateness = (days: number): string => `${said(spanOf(days))} late`

export interface Quiet {
  readonly days: number
  readonly label: string | undefined
  readonly space: number
}

const QUIET_LEAST = 1
const QUIET_MOST = 5

export const quietBetween = (from: string, to: string): Quiet => {
  const days = Math.max(daysBetween(dayOf(from), dayOf(to)) ?? 0, 0)
  return { days, label: quietLabel(days), space: spaceFor(days) }
}

const quietLabel = (days: number): string | undefined => {
  const span = quietSpan(days)
  return span === undefined ? undefined : `${spelled(span)} quiet ${span.unit}s`
}

const spaceFor = (days: number): number =>
  Math.min(
    Math.max(0.75 + Math.log2(Math.max(days, 1)) * 0.6, QUIET_LEAST),
    QUIET_MOST,
  )

interface Span {
  readonly count: string
  readonly unit: "day" | "week" | "month" | "year"
  readonly one: boolean
}

const MONTH_DAYS = 30.436875
const YEAR_DAYS = 365.2425

const spanOf = (days: number): Span => {
  const away = Math.abs(days)
  if (away < 14) return counted(away, "day")
  if (away < 60) return counted(Math.round(away / 7), "week")
  if (away < 550) return halved(away / MONTH_DAYS, "month")
  return halved(away / YEAR_DAYS, "year")
}

const counted = (count: number, unit: Span["unit"]): Span => ({
  count: String(count),
  unit,
  one: count === 1,
})

const halved = (value: number, unit: Span["unit"]): Span => {
  const rounded = Math.round(value * 2) / 2
  const whole = Math.floor(rounded)
  return {
    count: rounded > whole ? `${whole}½` : String(whole),
    unit,
    one: rounded === 1,
  }
}

const said = (span: Span): string =>
  `${span.count} ${span.unit}${span.one ? "" : "s"}`

const distanceOf = (standing: Standing, days: number): string => {
  if (standing === "today") return "Today"
  if (days === 1) return "Tomorrow"
  if (days === -1) return "Yesterday"
  const span = spanOf(days)
  return days > 0 ? `in ${said(span)}` : `${said(span)} ago`
}

const calendarOf = (day: string): string => {
  const weekday = weekdayOf(day)
  const month = MONTHS[Number(day.slice(5, 7)) - 1]
  if (weekday === null || month === undefined) return day
  return `${WEEKDAYS[weekday]!.slice(0, 3)}, ${month.slice(0, 3)} ${
    Number(day.slice(8, 10))
  }`
    .replace(/^./, (first) => first.toUpperCase())
}

const quietSpan = (days: number): Span | undefined => {
  const weeks = Math.round(days / 7)
  if (weeks < 2) return undefined
  return days < 60 ? counted(weeks, "week") : spanOf(days)
}

const NUMBERS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const

const spelled = (span: Span): string => NUMBERS[Number(span.count)] ?? span.count

const fadeOf = (standing: Standing, days: number): number => {
  if (standing !== "ahead" || days <= NEAR) return 1
  const faded = 1 - Math.log(days / NEAR) / ROLLOFF
  return Math.round(Math.max(faded, FURTHEST) * 100) / 100
}

const toneOf = (standing: Standing, days: number): Tone => {
  if (standing === "late") return "alarm"
  if (standing === "today") return "accent"
  return days <= NEAR ? "ink" : days <= FAR ? "muted" : "rule"
}
