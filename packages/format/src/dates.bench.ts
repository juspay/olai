import { TEST_CLAIMS } from "@olai/format/testlib"
import { type Agenda, agendaOf, type Owed, owedNow, owedOf } from "./agenda.ts"
import { datedAnswer, datedIn, datedOn, type DayGroup } from "./dates.ts"
import { derive, type Derived, owingOn } from "./derive.ts"
import {
  median,
  recordsOf,
  runtimeSaid,
  setOf,
  skippedAgenda,
  skippedDays,
  timed,
  timesSaid,
  vaultOf,
  walkedAgenda,
  walkedDays,
  walkedOn,
} from "./fixtures.testlib.ts"
import { type Dated, dateInto } from "./occasion.ts"

const FILES = Number(process.env["OLAI_BENCH_FILES"] ?? 1000)
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 21)
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 10)
const PER_ROUND = 20

const view = derive(TEST_CLAIMS,
  recordsOf(setOf(Object.fromEntries(vaultOf({ files: FILES, records: RECORDS })))),
)

const TODAY = "2026-01-15"
const MONTH = "2026-01"
const DAY = "2026-01-06"

const rows = (groups: ReadonlyArray<DayGroup>): string =>
  groups
    .map((group) => `${group.file}:${group.nodes.map((one) => one.shows.node.id).join(",")}`)
    .join("|")

const agendaSaid = (agenda: Agenda): string => {
  const owed = owedOf(agenda)
  const line = (days: Agenda["overdue"]): string =>
    days.map((one) => `${one.date}=${rows(one.groups)}`).join("|")
  return `${line(agenda.overdue)}\n${rows(agenda.today)}\n${line(agenda.upcoming)}\n` +
    `owed ${owed.overdue} ${owed.today}`
}

const folded = (derived: Derived): string => {
  const byDay = new Map<string, Array<Dated>>()
  for (const located of derived.nodes) dateInto(TEST_CLAIMS, byDay, located)
  const days: Array<string> = []
  const owedByDay = new Map<string, number>()
  for (const [day, own] of byDay) {
    days.push(day)
    const owed = owingOn(own)
    if (owed > 0) owedByDay.set(day, owed)
  }
  return `${byDay.size} days, ${owedByDay.size} owing, ${days.length} listed`
}

const owedSaid = (owed: Owed): string => `owed ${owed.overdue} ${owed.today}`

const READINGS: ReadonlyArray<{
  readonly what: string
  readonly index: (derived: Derived) => string
  readonly before?: (derived: Derived) => string
  readonly walk: (derived: Derived) => string
}> = [
  {
    what: "the calendar's dots, one month",
    index: (derived: Derived) => datedAnswer(derived, MONTH).days.join(" "),
    before: (derived: Derived) => skippedDays(derived, MONTH).join(" "),
    walk: (derived: Derived) => walkedDays(derived, MONTH).join(" "),
  },
  {
    what: "one day page",
    index: (derived: Derived) => rows(datedOn(derived, DAY)),
    walk: (derived: Derived) => rows(walkedOn(derived, DAY)),
  },
  {
    what: "the two counts a mark prints",
    index: (derived: Derived) => owedSaid(owedNow(derived, TODAY)),
    before: (derived: Derived) => owedSaid(owedOf(skippedAgenda(derived, TODAY))),
    walk: (derived: Derived) => owedSaid(owedOf(walkedAgenda(derived, TODAY))),
  },
  {
    what: "the agenda page itself",
    index: (derived: Derived) => agendaSaid(agendaOf(derived, TODAY)),
    before: (derived: Derived) => agendaSaid(skippedAgenda(derived, TODAY)),
    walk: (derived: Derived) => agendaSaid(walkedAgenda(derived, TODAY)),
  },
]

for (const reading of READINGS) {
  const found = reading.index(view)
  for (const [name, arm] of [["before", reading.before], ["walk", reading.walk]] as const) {
    const other = arm?.(view)
    if (other !== undefined && found !== other) {
      throw new Error(
        `the index and the ${name} arm disagree about ${reading.what}, so neither` +
          ` number means anything:\n  index:  ${found}\n  ${name}:  ${other}`,
      )
    }
  }
}
const days = view.byDay.size
if (days < 2) throw new Error(`the vault has ${days} days on it — this measures nothing`)

const run = (arm: (derived: Derived) => string): ReadonlyArray<number> => {
  for (let round = 0; round < 3; round++) arm(view)
  return Array.from({ length: ROUNDS }, () =>
    timed(() => {
      for (let at = 0; at < PER_ROUND; at++) arm(view)
    }) / PER_ROUND)
}

console.log(
  `vault: ${view.byFile.size} files, ${view.nodes.length} records, ${days} days in the` +
    ` index — each reading asked ${ROUNDS} × ${PER_ROUND} times, at ${TODAY}\n` +
    `the answers: ${datedAnswer(view, MONTH).days.length} dots in ${MONTH},` +
    ` ${datedIn(datedOn(view, DAY))} rows on ${DAY},` +
    ` ${agendaOf(view, TODAY).overdue.length} days owing something\n` +
    `${runtimeSaid()}\n`,
)

for (const reading of READINGS) {
  const index = run(reading.index)
  const before = reading.before === undefined ? null : run(reading.before)
  const walk = run(reading.walk)
  console.log(`${reading.what}`)
  console.log(`  ${timesSaid("index ", index, 6)}`)
  if (before !== null) console.log(`  ${timesSaid("before", before, 6)}`)
  console.log(`  ${timesSaid("walk  ", walk, 6)}`)
  if (before !== null) {
    console.log(`  → ${(median(before) / median(index)).toFixed(1)}× on the skip`)
  }
  console.log(`  → ${(median(walk) / median(index)).toFixed(1)}× on the walk\n`)
}

const fold = run(folded)
console.log(
  `${timesSaid("fold", fold, 6)}\n` +
    `what the index cost to build: ${
      median(fold).toFixed(2)
    }ms, once per rebuild — where each walk above was once per read`,
)
