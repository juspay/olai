import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  type Agenda,
  type AgendaDay,
  agendaOf,
  owedIn,
  owedNow,
  owedOf,
  owedReading,
} from "./agenda.ts"
import { datedDays, datedOn, type DayGroup } from "./dates.ts"
import { byDayKey, derive, type Derived } from "./derive.ts"
import {
  firstRowsOf,
  nodesOf,
  seeded,
  walkedAgenda,
  walkedByDay,
  walkedDays,
  walkedOn,
} from "./fixtures.testlib.ts"
import { timeOf } from "./occasion.ts"
import { patch, type SetDelta } from "./patch.ts"

const DAYS = [
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
  "2026-08-05",
  "2026-08-11",
  "2026-08-12",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-09-01",
] as const

const FILES = [
  "a.olai",
  "deep/b.olai",
  "_olai/Trash.olai",
  "old/Archive.olai",
] as const

const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

const dateFor = (random: () => number): string => {
  const day = pick(random, DAYS)
  return random() < 0.5 ? day : `${day}T0${Math.floor(random() * 9)}:15:00-04:00`
}

const recordOf = (random: () => number, id: string, at: number): string => {
  const record: Record<string, unknown> = { id, ord: `a${at}`, title: `row ${at}` }
  const roll = random()
  if (roll < 0.12) return JSON.stringify({ id, ord: `a${at}`, mirror: pick(random, IDS) })
  if (roll < 0.3) {
    const day = pick(random, DAYS)
    record["date"] = day
    record["done"] = `${day}T17:00:00-04:00`
    return JSON.stringify(record)
  }
  if (roll < 0.75) record["date"] = dateFor(random)
  if (random() < 0.55) {
    const mark = pick(random, ["done", "doing", "todo"])
    record[mark] = random() < 0.5 ? true : dateFor(random)
  }
  if (record["date"] !== undefined && random() < 0.15) {
    record["repeat"] = pick(random, ["every day", "every week on monday", "every month"])
  }
  return JSON.stringify(record)
}

const IDS = Array.from({ length: 30 }, (_, at) => `n${at}`)

const corpusOf = (random: () => number): Record<string, string> => {
  const corpus: Record<string, string> = {}
  let minted = 0
  for (const file of FILES) {
    const many = 1 + Math.floor(random() * 6)
    corpus[file] = Array.from(
      { length: many },
      (_, at) => recordOf(random, `n${minted++}`, at),
    ).join("\n")
  }
  return corpus
}

const viewOf = (corpus: Record<string, string>): Derived =>
  derive(TEST_CLAIMS, Object.entries(corpus).flatMap(([file, text]) => nodesOf(text, file)))

const editOf = (
  random: () => number,
  corpus: Record<string, string>,
): { readonly after: Record<string, string>; readonly delta: SetDelta } => {
  const file = pick(random, FILES)
  const many = Math.floor(random() * 6)
  const text = Array.from(
    { length: many },
    (_, at) => recordOf(random, `n${100 + at}`, at),
  ).join("\n")
  return {
    after: { ...corpus, [file]: text },
    delta: { upserts: [[file, { nodes: nodesOf(text, file) }]], removes: [] },
  }
}

const drawn = (groups: ReadonlyArray<DayGroup>): string =>
  groups
    .map((group) =>
      `${group.file}: ${
        group.nodes.map((node) => `${node.shows.node.id}/${node.occasion}@${node.date}`)
          .join(" ")
      }`
    )
    .join("\n")

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"] as const
const ROUNDS = 300

const saying = (story: () => string, asserted: () => void): void => {
  try {
    asserted()
  } catch (cause) {
    throw new Error(
      `${cause instanceof Error ? cause.message : String(cause)}\n\n${story()}`,
    )
  }
}

test("every day reading answers what the walk it replaced answered", () => {
  const random = seeded(20260820)
  let dated = 0
  let owed = 0
  for (let round = 0; round < ROUNDS; round++) {
    const corpus = corpusOf(random)
    const { after, delta } = editOf(random, corpus)
    const story = () =>
      `round ${round}\nbefore: ${JSON.stringify(corpus, null, 2)}\n` +
      `after: ${JSON.stringify(after, null, 2)}`

    for (const view of [viewOf(after), patch(viewOf(corpus), delta)]) {
      const walked = walkedByDay(view)
      if (walked.size > 0) dated++

      saying(story, () => {
        expect([...view.byDay.keys()]).toEqual([...walked.keys()].sort(byDayKey))
        for (const [day, bucket] of walked) {
          expect(view.byDay.get(day)).toEqual(bucket as never)
        }
        expect(view.days).toEqual([...walked.keys()].sort(byDayKey))

        for (const month of MONTHS) {
          expect([...datedDays(view, month)]).toEqual([...walkedDays(view, month)])
        }

        for (const day of [...DAYS, "2026-08-13"]) {
          expect(drawn(datedOn(view, day))).toBe(drawn(walkedOn(view, day)))
        }
      })

      for (const today of ["2026-08-11", "2026-08-20"]) {
        const agenda = agendaOf(view, today)
        if (owedIn(agenda) > 0) owed++
        saying(story, () => {
          expect(agendaSaid(agenda)).toBe(agendaSaid(walkedAgenda(view, today)))
          const walked = walkedAgenda(view, today)
          expect(owedNow(view, today)).toEqual(owedOf(walked))
          for (const cap of [0, 1, 3, 50]) {
            expect([cap, owedReading(view, today, cap)]).toEqual([cap, {
              ...owedOf(walked),
              rows: firstRowsOf(walked, cap),
            }])
          }
        })
      }
    }
  }
  expect(dated).toBeGreaterThan(ROUNDS)
  expect(owed).toBeGreaterThan(ROUNDS)
})

const agendaSaid = (agenda: Agenda): string => {
  const owed = owedOf(agenda)
  const line = (days: ReadonlyArray<AgendaDay>): string =>
    days.map((day) => `${day.date}\n${drawn(day.groups)}`).join("\n")
  return `late:\n${line(agenda.overdue)}\ntoday:\n${drawn(agenda.today)}\n` +
    `ahead:\n${line(agenda.upcoming)}\nowed: ${owed.overdue} late, ${owed.today} today`
}

test("a time is the five characters after either separator a date may be written with", () => {
  expect(timeOf("2026-09-08T14:00:00-04:00")).toBe("14:00")
  expect(timeOf("2026-09-08 14:00")).toBe("14:00")
  expect(timeOf("2026-09-08")).toBeUndefined()
})
