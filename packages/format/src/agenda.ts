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

import { byOutline, type DayEntry, type DayGroup, dayOf, datedOn } from "./dates.ts"
import { type Derived, situate, storedMarker } from "./derive.ts"
import { isMirror, type LocatedRegular, type RegularNode } from "./node.ts"

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
 * comes back a datetime. So `today` is a DAY, and a caller holding a datetime
 * owes it {@link dayOf} first.
 *
 * Asked of the node's OWN record, which is what makes a mirror's row answer
 * with its target's date and its target's mark: a placement carries neither.
 */
export const isOverdue = (node: RegularNode, today: string): boolean => {
  if (node.date === undefined) return false
  const mark = storedMarker(node)
  return (mark === "todo" || mark === "doing") && dayOf(node.date) < today
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
export const agendaOf = (derived: Derived, today: string): Agenda => ({
  overdue: byOutline(overdueEntries(derived, today)),
  today: unfinished(datedOn(derived, today)),
  upcoming: aheadOf(derived, today).map((date) => ({
    date,
    groups: unfinished(datedOn(derived, date)),
  })),
})

/** Nothing to show, said once: an empty agenda is a page that says so and
 *  offers nothing to press, and "empty" is the conjunction of three sections
 *  rather than something a view should re-derive. */
export const nothingDue = (agenda: Agenda): boolean =>
  agenda.overdue.length === 0 &&
  agenda.today.length === 0 &&
  agenda.upcoming.length === 0

/**
 * Every overdue node, as the entries a section is grouped from.
 *
 * A MIRROR contributes none — it is a placement, and the format gives it no
 * field to carry a date or a mark — so a task that is late is late once,
 * however many places it is shown. The occasion is always `date`: `done` is the
 * only other field a day reads, and a `done` node is not overdue.
 */
const overdueEntries = (
  derived: Derived,
  today: string,
): ReadonlyArray<DayEntry> => {
  const entries: Array<DayEntry> = []
  for (const located of derived.nodes) {
    const node = located.node
    if (isMirror(node)) continue
    // Read off the record rather than passed alongside it: the predicate has
    // already decided there is one.
    const date = node.date
    if (date === undefined || !isOverdue(node, today)) continue
    entries.push({
      ...situate(derived, located as LocatedRegular),
      occasion: "date",
      date,
    })
  }
  return entries
}

/**
 * The same groups with finished work left out, and the groups that were only
 * finished work gone with it.
 *
 * `done` never appears on this page at all — the agenda answers what is owed
 * and a day page answers what happened — so this is applied to every section
 * built out of a day's own answer. A node whose `done` is dated today is on
 * today's PAGE and not on today's agenda, which is the difference between the
 * two questions in one sentence.
 */
const unfinished = (
  groups: ReadonlyArray<DayGroup>,
): ReadonlyArray<DayGroup> =>
  groups.flatMap((group) => {
    const nodes = group.nodes.filter((entry) => entry.status !== "done")
    return nodes.length === 0 ? [] : [{ file: group.file, nodes }]
  })

/**
 * The days after `today` that have anything, ascending, bounded by {@link
 * UPCOMING_DAYS}.
 *
 * A day is nominated by a node that is SCHEDULED for it and not finished — the
 * only kind of record that can put anything on a future day's agenda, since the
 * other field a day reads is a dated `done` and finished work is not drawn
 * here. So every day this answers with is a day the section below it will have
 * something to show: "days with nothing do not appear" is a property of the
 * nomination rather than a filter run afterwards.
 */
const aheadOf = (derived: Derived, today: string): ReadonlyArray<string> => {
  const days = new Set<string>()
  for (const located of derived.nodes) {
    const node = located.node
    if (isMirror(node) || node.date === undefined) continue
    if (storedMarker(node) === "done") continue
    const day = dayOf(node.date)
    if (day > today) days.add(day)
  }
  return [...days].sort(Order.String).slice(0, UPCOMING_DAYS)
}
