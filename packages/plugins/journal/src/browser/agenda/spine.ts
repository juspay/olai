import {
  type Agenda,
  type AgendaDay,
  type DayEntry,
  type Felt,
  feltOn,
  type Quiet,
  quietBetween,
  type Tone,
} from "@olai/format"

import { tokenValue } from "@olai/appearance/css.ts"

const LEAD = 1.75

export const TAIL = "h-10"

export const inkOf = (tone: Tone | undefined): string =>
  tone === undefined ? "transparent" : tokenValue(tone)

export const NOW_RING = `0 0 0 3px ${tokenValue("paper")}, ` +
  `0 0 0 4px color-mix(in srgb, ${tokenValue("accent")} 35%, transparent)`

export interface Rung {
  readonly day: AgendaDay
  readonly felt: Felt
  readonly quiet: Quiet | undefined
  readonly from: Tone | undefined
}

export interface Line {
  readonly rungs: ReadonlyArray<Rung>
  readonly ending: Tone
}

export const spaceOf = (rung: Rung): number => rung.quiet?.space ?? LEAD

export const lineOf = (agenda: Agenda, today: string): Line => {
  const now: AgendaDay = { date: today, groups: agenda.today }
  const days: ReadonlyArray<AgendaDay> = [...agenda.overdue, now, ...agenda.upcoming]
  const felts = days.map((day) => feltOn(day.date, today))
  const last = agenda.upcoming[agenda.upcoming.length - 1] ?? now
  return {
    rungs: days.map((day, index) => ({
      day,
      felt: felts[index]!,
      quiet: index === 0 ? undefined : quietBetween(days[index - 1]!.date, day.date),
      from: felts[index - 1]?.tone,
    })),
    ending: feltOn(last.date, today).tone,
  }
}

export const rowsOn = (day: AgendaDay): ReadonlyArray<DayEntry> =>
  day.groups.flatMap((group) => group.nodes)

export const trackOf = (rung: Rung): string =>
  `linear-gradient(to bottom, ${inkOf(rung.from)} 0, ` +
  `${inkOf(rung.felt.tone)} ${spaceOf(rung)}rem, ` +
  `${inkOf(rung.felt.tone)} 100%)`

export const tailOf = (tone: Tone): string =>
  `linear-gradient(to bottom, ${inkOf(tone)}, transparent)`
