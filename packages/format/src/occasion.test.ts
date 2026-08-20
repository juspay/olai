/**
 * THE INDEX AGAINST THE WALK IT REPLACED.
 *
 * `perf-dates-index` deleted a pass over every record of every outline and put
 * `Derived.byDay` in its place, and the whole risk of that trade is that a
 * lookup answers something a walk did not: a day short a node, a day the
 * calendar draws no dot for, an overdue day that quietly stopped being late.
 * Nothing above this file could tell — every one of those is a plausible page.
 *
 * So the WALK IS THE ORACLE, exactly as `derive` is `./patch.test.ts`'s: it is
 * written out here, once, in the shape it stood in (`datedNodes` over
 * `derived.nodes`, bucketed by day; the month filtered out of it; the agenda's
 * two halves sorting the keys they needed), and every generated corpus is asked
 * both ways. What the walk answers is what the index must answer.
 *
 * IT IS HERE AND NOT IN THE SHIPPED CODE, which is the difference between an
 * oracle and legacy: the walk has one caller and it is this file's assertions.
 *
 * The generator writes the corners a day reading can be wrong in, and each is
 * there for a reason a seed could not be trusted to reach:
 *
 *   - BOTH FIELDS, and a mark carrying `true` beside a mark carrying an
 *     instant: `date` and a dated `done` are what put a node on a day, a dated
 *     `doing` is a legal record that puts it on none, and `done: true` is the
 *     shape everything written before instants still has;
 *   - THE SAME DAY TWICE ON ONE RECORD — scheduled for a day and finished on
 *     it — which is where `datesOf`'s precedence decides a row and where a day
 *     page that drew two would be claiming two things happened;
 *   - THE TRASH AND A LEFTOVER `Archive.olai`, both full of dated records,
 *     because what was put away is on no day and the index leaves it out at the
 *     FOLD rather than at each read (`./occasion.ts`);
 *   - MIRRORS, which carry neither field and must contribute nothing however
 *     many places they stand in;
 *   - A REPEATING NODE MID-CHAIN: a live head with `repeat` and a `date` ahead
 *     of it, and the finished occurrence behind it carrying the instant it was
 *     completed at. That is what a recurrence IS in this format (./repeat.ts) —
 *     one live head, never a projection — so what the index owes a repeat is
 *     exactly what it owes those two records, and this pins it rather than
 *     leaving a reader to infer it from the absence of a rule.
 *
 * AND THE PATCHED VIEW IS ASKED TOO, not only the derived one. The index a
 * reader holds after an edit came out of `patch`, and an incremental fold that
 * agreed with the walk only when rebuilt from scratch would be the one failure
 * this whole file exists to catch.
 */

import { expect, test } from "bun:test"

import {
  type Agenda,
  type AgendaDay,
  agendaOf,
  isOverdue,
  owedIn,
  owedOf,
  UPCOMING_DAYS,
} from "./agenda.ts"
import { datedDays, datedOn, type DayGroup, groupedOn } from "./dates.ts"
import { byDayKey, derive, type Derived } from "./derive.ts"
import { nodesOf, seeded } from "./fixtures.testlib.ts"
import { isMirror, isPutAway, type LocatedRegular, storedMarker } from "./node.ts"
import { type Dated, datesOf, dayOf, monthOf } from "./occasion.ts"
import { patch, type SetDelta } from "./patch.ts"

// ── the oracle: the walk, as it stood ──────────────────────────────────

/** Every date of every node of the set, in file order, a node contributing one
 *  for each date it carries — `dates.ts`'s deleted `datedNodes`, verbatim. */
const datedNodes = (derived: Derived): ReadonlyArray<Dated> =>
  derived.nodes.flatMap((located) =>
    isMirror(located.node) || isPutAway(located.file)
      ? []
      : datesOf(located.node).map((dated) => ({
        at: located as LocatedRegular,
        ...dated,
      }))
  )

/** ...bucketed by the day each falls on — the deleted `datedByDay`. */
const walkedByDay = (derived: Derived): ReadonlyMap<string, ReadonlyArray<Dated>> => {
  const days = new Map<string, Array<Dated>>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    const bucket = days.get(day)
    if (bucket === undefined) days.set(day, [dated])
    else bucket.push(dated)
  }
  return days
}

/** The days of one month that had anything on them — the deleted `datedDays`,
 *  which answered a SET and left the ordering to whoever printed it. Sorted
 *  here so the comparison is about which days, not about a container. */
const walkedDays = (derived: Derived, month: string): ReadonlyArray<string> => {
  const days = new Set<string>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    if (monthOf(day) === month) days.add(day)
  }
  return [...days].sort(byDayKey)
}

/** Which days the whole set has anything on — the same walk asked without a
 *  month, which is what a `byDay` key set has to be. */
const walkedKeys = (derived: Derived): ReadonlyArray<string> =>
  [...walkedByDay(derived).keys()].sort(byDayKey)

// ── the corpora ────────────────────────────────────────────────────────

/** Two months and a boundary, so the calendar's month walk has an edge to stop
 *  at and the agenda's line has days either side of any `today` drawn from it. */
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

/** The files a corpus is spread over: two live outlines, one in a directory,
 *  the trash, and a leftover `Archive.olai` — the last two dated on purpose,
 *  because what they hold is what the fold must drop. */
const FILES = [
  "a.olai",
  "deep/b.olai",
  "_olai/Trash.olai",
  "old/Archive.olai",
] as const

const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

/** A day, half the time with a time on it: a datetime lands on its DAY, and an
 *  index keyed by the raw value would draw a dot per appointment. */
const dateFor = (random: () => number): string => {
  const day = pick(random, DAYS)
  return random() < 0.5 ? day : `${day}T0${Math.floor(random() * 9)}:15:00-04:00`
}

/** One record: a date, a mark, both or neither — and now and then the pair that
 *  lands one node on one day twice. */
const recordOf = (random: () => number, id: string, at: number): string => {
  const record: Record<string, unknown> = { id, ord: `a${at}`, title: `row ${at}` }
  const roll = random()
  if (roll < 0.12) return JSON.stringify({ id, ord: `a${at}`, mirror: pick(random, IDS) })
  if (roll < 0.3) {
    // Scheduled for a day and finished on THAT day — one node, two dates, one
    // row, and `datesOf`'s precedence deciding which occasion names it.
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
  // A live head of a recurrence: a rule needs a date to repeat FROM, so this
  // only ever rides a record that has one (./parse.ts refuses otherwise).
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
  derive(Object.entries(corpus).flatMap(([file, text]) => nodesOf(text, file)))

/** ONE file rewritten, which is the delta a keystroke makes and the one the
 *  index is patched across. */
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

// ── the property ───────────────────────────────────────────────────────

/** What a day reading answered, as text — the file, the id and the occasion of
 *  every row, in the order it drew them. Compared this way rather than by deep
 *  equality because it is the DRAWN answer that must not move, and because a
 *  mismatch that prints two lists of ids is one somebody can act on. */
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

    // The derived view and the PATCHED one, because a reader holds the second.
    for (const view of [viewOf(after), patch(viewOf(corpus), delta)]) {
      const walked = walkedByDay(view)
      if (walked.size > 0) dated++

      // The index holds the walk's buckets, in the walk's own order, under the
      // walk's own keys — and its keys ASCENDING, which the walk never promised
      // and three readings now spend.
      expect([...view.byDay.keys()]).toEqual([...walkedKeys(view)])
      for (const [day, bucket] of walked) {
        expect(view.byDay.get(day)).toEqual(bucket as never)
      }

      // The calendar's dots, month by month — including one the corpus has
      // nothing in, which must be an empty answer rather than a refusal.
      for (const month of MONTHS) {
        expect([...datedDays(view, month)]).toEqual([...walkedDays(view, month)])
      }

      // A day page, for every day the corpus can reach and one it cannot.
      for (const day of [...DAYS, "2026-08-13"]) {
        expect(drawn(datedOn(view, day))).toBe(drawn(groupedWalk(view, walked, day)))
      }

      // ...and the forward reading, from a day in the middle of the span, so
      // there is something behind it and something ahead of it.
      for (const today of ["2026-08-11", "2026-08-20"]) {
        const agenda = agendaOf(view, today)
        if (owedIn(agenda) > 0) owed++
        expect(agendaSaid(agenda)).toBe(agendaSaid(walkedAgenda(view, walked, today)))
      }
    }
  }
  // The claim that any of the above was asked at all (`./vault.test.ts`'s
  // reason): a corpus with nothing on a day compares two empty answers 300
  // times and says nothing while doing it.
  expect(dated).toBeGreaterThan(ROUNDS)
  expect(owed).toBeGreaterThan(ROUNDS)
})

// ── the walk's own readings, and how an answer is said ─────────────────

/** A day's rows, walked — `datedOn` with the bucket taken from the oracle's map
 *  instead of from the index. */
const groupedWalk = (
  derived: Derived,
  walked: ReadonlyMap<string, ReadonlyArray<Dated>>,
  day: string,
): ReadonlyArray<DayGroup> => groupedOn(derived, walked.get(day) ?? [])

/**
 * The agenda as it stood: every day the set has sorted per read, then filtered
 * per half.
 *
 * BOTH COMPARISONS ARE KEPT AS THEY WERE — `dayOf(today)` behind, the caller's
 * own value ahead and for today's own bucket — because an oracle that quietly
 * corrected one of them would be asserting a change rather than the absence of
 * one. Every door sends a plain day, so the two spellings answer identically for
 * everything anything sends; what this file is for is saying that the INDEX
 * changed nothing, and a straightened oracle could not say it.
 */
const walkedAgenda = (
  derived: Derived,
  walked: ReadonlyMap<string, ReadonlyArray<Dated>>,
  today: string,
): Agenda => {
  const days = [...walked.keys()].sort(byDayKey)
  const overdue: Array<AgendaDay> = []
  for (const date of days.filter((day) => day < dayOf(today))) {
    const owed = (walked.get(date) ?? []).filter((one) => isOverdue(one.at.node, today))
    if (owed.length > 0) overdue.push({ date, groups: groupedOn(derived, owed) })
  }
  const upcoming: Array<AgendaDay> = []
  for (const date of days.filter((day) => day > today)) {
    if (upcoming.length === UPCOMING_DAYS) break
    const groups = owedWalk(derived, walked.get(date) ?? [])
    if (groups.length > 0) upcoming.push({ date, groups })
  }
  return { overdue, today: owedWalk(derived, walked.get(today) ?? []), upcoming }
}

/** What is OWED on one day: the day's records minus what is finished. */
const owedWalk = (
  derived: Derived,
  dated: ReadonlyArray<Dated>,
): ReadonlyArray<DayGroup> =>
  groupedOn(derived, dated.filter((one) => storedMarker(one.at.node) !== "done"))

/**
 * A whole agenda, as text: the three stretches with their days and rows, and
 * the two numbers a mark outside the page prints.
 *
 * THE COUNTS RIDE THE COMPARISON rather than being asserted beside it, because
 * `owedOf` is a pure function of this answer — so a walked agenda and an
 * indexed one that say the same thing here cannot be counted differently, and
 * the sidebar's number is pinned by the same round as the page's rows.
 */
const agendaSaid = (agenda: Agenda): string => {
  const owed = owedOf(agenda)
  const line = (days: ReadonlyArray<AgendaDay>): string =>
    days.map((day) => `${day.date}\n${drawn(day.groups)}`).join("\n")
  return `late:\n${line(agenda.overdue)}\ntoday:\n${drawn(agenda.today)}\n` +
    `ahead:\n${line(agenda.upcoming)}\nowed: ${owed.overdue} late, ${owed.today} today`
}
