/**
 * What a day reading costs per revision: the index read against the corpus
 * walks it replaced.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and it carries TWO roadmap nodes
 * now. `perf-dates-index` named three full-vault walks — the calendar's dots, a
 * day page, the agenda's three stretches — and said the fix shape the house
 * already owns is an index on `Derived` maintained by the patcher.
 * `perf-agenda-history-walk` named what that left standing: the SKIP to where a
 * reading starts, and the whole agenda assembled to be counted. A number nobody
 * can re-run is a number nobody can check, so every before is an arm of one run
 * rather than a paragraph, and each bullet of each node is its own row here
 * rather than one blended figure.
 *
 * PER REVISION IS THE UNIT, and that is what makes the ratios mean anything.
 * These readings ran in the browser, once per drawn page, until
 * `vault-in-browser`'s PR 4 moved two of them to the server — where they are
 * re-answered on every published revision, for every open tab, and sent only
 * when the answer changed (`@olai/server`'s `runtime.ts`). A walk per call was
 * affordable when a call meant somebody opened the calendar; it stopped being
 * affordable when a call means somebody typed a character anywhere in the
 * directory.
 *
 * FOUR READINGS over one generated vault (`./fixtures.testlib.ts`'s `vaultOf`,
 * the SAME corpus `./patch.bench.ts` and `./vocabulary.bench.ts` run on, so this
 * leg's numbers and theirs are about one directory), each asked of the index
 * and of the walk — and the FOLD.
 *
 * THREE OF THEM HAVE A THIRD ARM, and that is `perf-agenda-history-walk`
 * (2026-08-25), the second node this leg carries. `perf-dates-index` made the
 * ANSWERS a lookup and left one thing walked: a map's keys can only be stepped
 * from the front, so the calendar reached its month and the agenda reached
 * tomorrow by skipping every earlier day one at a time — and the two COUNTS a
 * mark outside the agenda prints were the whole agenda assembled and then
 * counted, every overdue node in the directory situated to produce two
 * integers. The middle arm (`before`) is each of those readings in the shape it
 * had between the two nodes, so what this branch bought is a ratio somebody can
 * re-take rather than a sentence — and the outer arm is still the corpus walk,
 * which is a different question and is why both are printed.
 *
 * THE COUNTS ARE THEIR OWN READING NOW, which is the fourth: they used to be
 * `owedOf` over the agenda arm above them, and reading them off the index the
 * patcher keeps is the whole of what the node asked for. Two spellings of one
 * number, so what holds them together is a differential rather than a shape
 * (`./occasion.test.ts`, `@olai/ops`' `owed.index.test.ts`) — and the guard
 * below, which checks all three arms of every reading answer the same value.
 *
 * The walk arms are the code that stood before the index, kept once in
 * `./fixtures.testlib.ts` because this file divides by it and
 * `./occasion.test.ts` asserts against it — two reconstructions could disagree,
 * and then a ratio here would be about the difference between them.
 *
 * THE FOLD is the half a ratio never shows: `dateInto` over every record, and
 * the two readings counted out of what it filed — which is the work `derive`
 * gained, across both nodes. It answers a different thing from the readings
 * above, so it is timed beside them and compared with none of them — and it is
 * the number that says what the trade IS, since it is paid once per rebuild
 * where a walk was paid once per read. What one WRITE pays for the same two is
 * `./patch.bench.ts`'s, not this file's: an index is folded here and patched
 * there.
 *
 * EVERY ARM MUST ANSWER THE SAME VALUE, asserted before anything is timed. It
 * is what stops this being a benchmark of an arm that answers nothing: a fast
 * arm could "win" by returning an empty list and the comparison would still
 * print. `./vault.test.ts` is the other half of that fence — it asserts, at the
 * size this runs, that the vault really is scheduled.
 *
 * A FRESH DERIVED PER MEASUREMENT is NOT needed and is not done, unlike
 * `./vocabulary.bench.ts` next door: nothing memoises a day reading per
 * derivation, so asking one view twice costs what asking a new one costs.
 */

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
/** How many times each arm is asked. */
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 10)
/**
 * How many times one measurement asks its reading, before dividing by it.
 *
 * The two cheap readings are a map lookup and a walk of one month's keys — tens
 * of MICROseconds, which `performance.now()` reports as `0.00ms` and a ratio
 * divides by. A figure that says "3,000×" off a zero denominator is not a
 * measurement, it is a rounding error with a multiplication sign after it. So a
 * round asks the reading twenty times and the timing is divided by twenty,
 * which is the same per-call number said with digits in it.
 */
const PER_ROUND = 20

/** The vault, through the REAL assembly (`setOf`) rather than a flatten written
 *  here: path order is a promise of the format's own, and a bench that spells it
 *  again is a bench that can come to measure a corpus in an order no app holds. */
const view = derive(
  recordsOf(setOf(Object.fromEntries(vaultOf({ files: FILES, records: RECORDS })))),
)

/** The day the agenda is read from, and the month and day the other two are
 *  asked about — inside the vault's span (`./fixtures.testlib.ts`'s `dateFor`
 *  writes two years from 2025), so every arm has something to answer and the
 *  agenda has days behind it as well as ahead. */
const TODAY = "2026-01-15"
const MONTH = "2026-01"
/** The day the day-page arm draws — a BUSY one (a dozen rows over several
 *  outlines), because a day page's cost is the rows it situates and a day with
 *  one row on it would measure the lookup and nothing else. */
const DAY = "2026-01-06"

/** A day reading, as text: what must not move between two arms is the ANSWER,
 *  and a mismatch that prints two strings is one somebody can act on. */
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

/** What the index costs the fold: `dateInto` over every record, and then the
 *  two readings kept beside it counted out of what that filed
 *  (`Derived.owedByDay` and `Derived.days`) — which is what `derive` gained,
 *  across both nodes. The maps are built and thrown away, exactly as the index
 *  is built and kept. */
const folded = (derived: Derived): string => {
  const byDay = new Map<string, Array<Dated>>()
  for (const located of derived.nodes) dateInto(byDay, located)
  const days: Array<string> = []
  const owedByDay = new Map<string, number>()
  for (const [day, own] of byDay) {
    days.push(day)
    const owed = owingOn(own)
    if (owed > 0) owedByDay.set(day, owed)
  }
  return `${byDay.size} days, ${owedByDay.size} owing, ${days.length} listed`
}

/** The two counts, as text — what the mark outside the agenda prints. */
const owedSaid = (owed: Owed): string => `owed ${owed.overdue} ${owed.today}`

/** The three readings the node names, each with the two ways to answer it and a
 *  name for what it is. Written as one table so a pair cannot come to be timed
 *  without being checked, which is the failure the guard below exists for. */
const READINGS: ReadonlyArray<{
  readonly what: string
  readonly index: (derived: Derived) => string
  /** The same reading as it stood between the two nodes — an index read with
   *  the skip still in it, or an agenda assembled to be counted. Absent for a
   *  reading `perf-agenda-history-walk` did not touch, which is the day page:
   *  it takes one key and has never stepped to it. */
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

// THE SAME ANSWER, per ARM, before anything is timed — see the header. Every
// arm of a reading against the index's, so a "before" that quietly answers
// something else fails the run rather than printing a flattering ratio.
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
  // Warmed, then measured, for `./patch.bench.ts`'s reason: one arm has to go
  // first, and going first means paying for a JIT the others find warm.
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
  // Two ratios where there is a third arm, and they answer two questions: what
  // THIS branch bought (against the reading as it stood) and what the pair of
  // nodes bought (against the corpus walk both replaced).
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
