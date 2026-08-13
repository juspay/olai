/**
 * The set, read forward: what is OWED.
 *
 * A day page asks what is on a day; this asks what has not happened yet and
 * should have. It is the same kind of question and the same kind of answer —
 * derived at view time, over every node in every outline, stored nowhere — so
 * it is built out of ./dates.ts rather than beside it (docs/brainstorming/
 * agenda.md, ratified 2026-08-12).
 *
 * ## No new field: `date` and the mark, read together
 *
 * The format already keeps the two questions apart — `date` says WHEN, a mark
 * says whether it is work — and an agenda is what they answer together:
 *
 *   - `date` and NO mark is an OCCURRENCE: a birthday, an appointment, a note
 *     pinned to a day. It can never be overdue, because a day passing is not a
 *     failure of a bullet. That is the crown rule of the format read once more
 *     (docs/format.md's Status): an unmarked node is not an unfinished one.
 *   - `date` with `todo` or `doing` is DUE WORK — the only thing that can be
 *     late, because somebody said it was work and said when.
 *
 * A second `due` field beside `date` would have been two dates answering one
 * question, which is the disagreement the mirror shape exists to make
 * unrepresentable. So nothing here is stored and nothing here is written.
 *
 * ## Overdue is the next `blocked`
 *
 * {@link isOverdue} is spelled ONCE and read everywhere — the agenda's first
 * section and the tone every date badge takes are one predicate, for the reason
 * blockedness is one predicate read at both ends of its arrow (./derive.ts): two
 * spellings would be two chances to disagree about what late work is. It is a
 * SECOND fact about a node and never a replacement for its mark, and `done`
 * extinguishes it by construction — a finished task is late at nothing.
 *
 * The one thing this reading needs that the set cannot give it is what day it
 * IS, so `today` is an argument at every entry point here. A clock in this
 * package would be a fact about the reader smuggled into a fact about the
 * directory — and a derivation whose answer changed with the machine it ran on.
 */

import { Order } from "effect"

import {
  byOutline,
  type Dated,
  datedByDay,
  type DayEntry,
  type DayGroup,
  dayOf,
  entryOf,
  groupedOn,
} from "./dates.ts"
import { type Derived, storedMarker } from "./derive.ts"
import type { RegularNode } from "./node.ts"

/**
 * Should this have happened by now?
 *
 * `overdue(n) ⇔ n carries todo or doing ∧ day(n.date) < today`, and the two
 * halves are both load-bearing. The MARK half is written as the two marks it
 * names rather than as `mark !== "done"`, which is the trap blockedness is
 * written against one file over: that spelling reads every plain dated bullet
 * as work somebody is late on, which is exactly what an occurrence is not.
 * `doing` is in (human, 2026-08-12: started-but-unfinished is the most honest
 * yes to the question this asks; the narrower todo-only reading was declined).
 *
 * The DAY half is plain string comparison over the first ten characters, here
 * as everywhere — dates are text, and a `2026-08-10` put through an instant
 * comes back a datetime. BOTH SIDES go through {@link dayOf}, including the one
 * the caller supplies: this is the predicate the whole feature reads, so it
 * answers about a day whatever shape of ISO value it is handed rather than
 * relying on every caller to have trimmed one first. An instant for `today`
 * used to make work due TODAY read as late — `"2026-08-12" < "2026-08-12T09:00"`
 * is true, a prefix being less than what extends it — which is the one wrong
 * answer this comparison can give.
 *
 * Asked of the node's OWN record, which is what makes a mirror's row answer
 * with its target's date and its target's mark: a placement carries neither.
 */
export const isOverdue = (node: RegularNode, today: string): boolean => {
  if (node.date === undefined) return false
  const mark = storedMarker(node)
  return (mark === "todo" || mark === "doing") && dayOf(node.date) < dayOf(today)
}

/** One day ahead, and what is on it. The date is a HEADING here rather than a
 *  page — the day's own page is where it is read in full, note and finished
 *  work and all — so it travels as the text it will be printed and linked as. */
export interface AgendaDay {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
}

/**
 * What is owed, in the three answers a reader wants.
 *
 * Three sections rather than one list because they are three different pieces
 * of news, and only the first is one no day page can give: a slipped task is on
 * a day nobody visits.
 */
export interface Agenda {
  /** Every overdue node in the set, oldest date first within each outline. */
  readonly overdue: ReadonlyArray<DayGroup>
  /** What today's day page holds, minus finished work. */
  readonly today: ReadonlyArray<DayGroup>
  /** The next days that have anything. Days with nothing are absent. */
  readonly upcoming: ReadonlyArray<AgendaDay>
}

/**
 * How far ahead Upcoming looks: the next seven days that HAVE something, not
 * the next seven days.
 *
 * A count of populated days rather than a window of dates, and that is the
 * whole of the bound — a horizon in days would be date arithmetic, which this
 * package deliberately does not do (dates are text), and a horizon a reader
 * could configure would be a setting invented for a question nobody has asked
 * yet. What it costs is honest: a directory with something on every day shows a
 * week, and one with something once a month shows seven months. Both are "the
 * next few things", which is what an agenda is for.
 */
export const UPCOMING_DAYS = 7

/**
 * The agenda: one reading of the whole set, at `today`.
 *
 * The ARCHIVE is not excluded, for the reason a day page does not exclude it
 * (./dates.ts): blockedness exempts archived work because nothing can wait on
 * work that is over, and this is asking the other question — a node that says
 * `todo` and names a day still says both of those things wherever it was filed,
 * and the group heading says which file that was.
 */
export const agendaOf = (derived: Derived, today: string): Agenda => {
  // ONE walk over the set, for all three sections and every day in the third:
  // each of them is a question about a day, and asking nine of them of nine
  // walks is what a bucketed reading exists to stop (./dates.ts).
  const days = datedByDay(derived)
  return {
    overdue: byOutline(overdueEntries(derived, days, today)),
    today: owedOn(derived, days, today),
    upcoming: aheadOf(derived, days, today),
  }
}

/** Nothing to show, said once: an empty agenda is a page that says so and
 *  offers nothing to press, and "empty" is the conjunction of three sections
 *  rather than something a view should re-derive. */
export const nothingDue = (agenda: Agenda): boolean =>
  agenda.overdue.length === 0 &&
  agenda.today.length === 0 &&
  agenda.upcoming.length === 0

/** Every day the set has anything on, and what it has on it. */
type Days = ReadonlyMap<string, ReadonlyArray<Dated>>

/**
 * Every overdue node, as the entries a section is grouped from.
 *
 * A MIRROR contributes none, and that is the bucketed walk's rule rather than
 * one restated here — a mirror is a placement, and the format gives it no field
 * to carry a date or a mark, so a task that is late is late once however many
 * places it is shown.
 *
 * ONE ENTRY PER NODE falls out rather than being deduplicated: a record's two
 * dates are its `date` and a dated `done`, and a node whose mark is `done` is
 * not overdue — so only the first of them can ever be here.
 */
const overdueEntries = (
  derived: Derived,
  days: Days,
  today: string,
): ReadonlyArray<DayEntry> => {
  const entries: Array<DayEntry> = []
  for (const dated of days.values()) {
    for (const one of dated) {
      if (isOverdue(one.at.node, today)) entries.push(entryOf(derived, one))
    }
  }
  return entries
}

/**
 * What is OWED on one day: everything the day page would show, minus what is
 * finished.
 *
 * `done` never appears anywhere on this page — the agenda answers what is owed
 * and a day page answers what happened — so the filter is applied to every
 * section built out of a day's records. A node whose `done` is dated today is
 * on today's PAGE and not on today's agenda, which is the difference between
 * the two questions in one sentence.
 *
 * Filtered BEFORE the entries are situated, which is the cheap order: situating
 * is an ancestry walk and a rollup per node, and a day whose work is finished
 * would be paying both to have the answer thrown away.
 */
const owedOn = (
  derived: Derived,
  days: Days,
  day: string,
): ReadonlyArray<DayGroup> =>
  groupedOn(derived, (days.get(day) ?? []).filter((one) => unfinished(one.at.node)))

/** Anything that is not finished work — the one spelling of it in this module,
 *  because "what is left" is the question the whole page asks and two ways of
 *  answering it would be two chances to disagree. */
const unfinished = (node: RegularNode): boolean => storedMarker(node) !== "done"

/**
 * The days after `today` that have something owed on them, ascending, bounded
 * by {@link UPCOMING_DAYS}.
 *
 * "Days with nothing do not appear" is asked with the SAME filter that draws
 * the day — a day is listed exactly when `owedOn` has something for it — rather
 * than with a nomination rule that could quietly disagree with it and leave a
 * heading over an empty section.
 */
const aheadOf = (
  derived: Derived,
  days: Days,
  today: string,
): ReadonlyArray<AgendaDay> => {
  const ahead: Array<AgendaDay> = []
  for (
    const date of [...days.keys()].filter((day) => day > today).sort(Order.String)
  ) {
    if (ahead.length === UPCOMING_DAYS) break
    const groups = owedOn(derived, days, date)
    if (groups.length > 0) ahead.push({ date, groups })
  }
  return ahead
}
