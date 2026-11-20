import {
  type AgendaDay as FormatAgendaDay,
  agendaOf,
  type DayEntry,
  type DayGroup,
  datedOn,
  isDay,
  type Reading,
} from "@olai/format"
import { Effect } from "effect"

import { name } from "./wire.ts"

export interface AgendaAsk {
  readonly at: unknown
  readonly date: string
}

export interface AgendaRefused {
  readonly reason: string
}

export interface AgendaRow {
  readonly id: string
  readonly title: string
  readonly date: string
  readonly status: string | null
}

export interface AgendaGroup {
  readonly file: string
  readonly nodes: ReadonlyArray<AgendaRow>
}

export interface AgendaDay {
  readonly date: string
  readonly groups: ReadonlyArray<AgendaGroup>
}

export interface AgendaAnswer {
  readonly date: string
  readonly dated: ReadonlyArray<AgendaGroup>
  readonly agenda: {
    readonly overdue: ReadonlyArray<AgendaDay>
    readonly today: ReadonlyArray<AgendaGroup>
    readonly upcoming: ReadonlyArray<AgendaDay>
  }
}

export interface JournalAgenda {
  readonly read: (ask: AgendaAsk) => Effect.Effect<AgendaAnswer, AgendaRefused>
}

export const WORD = "agenda"

export const KEY = `${name}.${WORD}`

export const readingIn = (at: unknown): Reading | null => {
  if (typeof at !== "object" || at === null) return null
  const held = at as { readonly derived?: unknown }
  return typeof held.derived === "object" && held.derived !== null ? (at as Reading) : null
}

const rowOf = (entry: DayEntry): AgendaRow => ({
  id: entry.shows.node.id,
  title: entry.shows.node.title,
  date: entry.date,
  status: entry.status ?? null,
})

const groupsOf = (groups: ReadonlyArray<DayGroup>): ReadonlyArray<AgendaGroup> =>
  groups.map((group) => ({ file: group.file, nodes: group.nodes.map(rowOf) }))

const daysOf = (days: ReadonlyArray<FormatAgendaDay>): ReadonlyArray<AgendaDay> =>
  days.map((day) => ({ date: day.date, groups: groupsOf(day.groups) }))

const answerFor = (at: Reading, date: string): AgendaAnswer => {
  const owed = agendaOf(at.derived, date)
  return {
    date,
    dated: groupsOf(datedOn(at.derived, date)),
    agenda: {
      overdue: daysOf(owed.overdue),
      today: groupsOf(owed.today),
      upcoming: daysOf(owed.upcoming),
    },
  }
}

export const door: JournalAgenda = {
  read: ({ at, date }) =>
    Effect.suspend(() => {
      if (!isDay(date)) {
        return Effect.fail({
          reason: `\`${date}\` is not a day (YYYY-MM-DD), so there is no agenda to read for it`,
        })
      }
      const reading = readingIn(at)
      if (reading === null) {
        return Effect.fail({
          reason: "the value handed to `journal.agenda` is not a vault reading — "
            + "pass on what the vault's revision door gave you, unchanged",
        })
      }
      return Effect.succeed(answerFor(reading, date))
    }),
}
