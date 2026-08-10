/**
 * The set, read by day.
 *
 * A `date` on a node is the whole of the journal. There is no stored year →
 * month hierarchy, no `Daily.jsonl`, no filename anything is special about
 * (docs/format.md; rewrite decision 11): a day is a QUESTION asked of every
 * node in every outline, and the answer is computed here, at view time, from
 * the same records the validator approved.
 *
 * Two questions, because there are two surfaces asking:
 *
 *   - {@link datedDays} — which days of one month have anything on them, which
 *     is what puts a dot under a number in the calendar;
 *   - {@link datedOn} — everything dated one day, grouped by the outline it
 *     lives in and carrying the ancestry that says what it is ABOUT, which is
 *     the day view.
 *
 * They are one module because they are one reading of the set, and a calendar
 * whose dots disagreed with the day you opened would be worse than no calendar.
 *
 * Dates are TEXT here, as they are everywhere else in this package: the format
 * validates them as ISO and stores them verbatim, so a day is a prefix and a
 * month is a shorter one. Nothing is parsed into an instant — a date-only
 * `2026-08-10` put through one comes back a datetime, and a calendar has no
 * business being the first place in the codebase that risks it.
 */

import { type Derived, type Situated, situate } from "./derive.ts"
import { isMirror, type LocatedRegular } from "./node.ts"

/** How many characters of an ISO value name the day, and the month. A
 *  datetime is a day plus a time, so the day is the prefix they share. */
const DAY = 10
const MONTH = 7

/**
 * The calendar day a `date` value falls on.
 *
 * A datetime counts for its day: `2026-08-10T14:30` is the 10th, because a
 * person asking what is on the 10th means the meeting at half past two. The
 * value is validated ISO by the time it reaches here (parse.ts), so the day is
 * the first ten characters and no arithmetic is involved.
 */
export const dayOf = (value: string): string => value.slice(0, DAY)

/** The month a day belongs to, `YYYY-MM`. Same rule, three characters shorter. */
export const monthOf = (value: string): string => value.slice(0, MONTH)

/** A node that carries a date, with the date lifted out of it. Lifted because
 *  `date` is optional on the record and is not optional here: every function
 *  below would otherwise re-narrow a field this one walk already decided. */
interface Dated {
  readonly at: LocatedRegular
  readonly date: string
}

/** Every dated node of the set, in file order. A mirror never has one — it is
 *  a placement, and the format gives it no field to carry a date — so a node
 *  dated the 10th is on the 10th once, however many places it is shown. */
const datedNodes = (derived: Derived): ReadonlyArray<Dated> =>
  derived.nodes.flatMap((located) =>
    isMirror(located.node) || located.node.date === undefined
      ? []
      : [{ at: located as LocatedRegular, date: located.node.date }]
  )

/**
 * The days of `month` (`YYYY-MM`) that have at least one dated node.
 *
 * A SET, not counts: the calendar draws a dot, and a number nothing prints is
 * a fact with no reader. Days outside the month are left out, so a caller that
 * asks about a month with nothing in it gets an empty answer rather than a
 * grid it has to filter for itself.
 */
export const datedDays = (derived: Derived, month: string): ReadonlySet<string> => {
  const days = new Set<string>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    if (monthOf(day) === month) days.add(day)
  }
  return days
}

/** The nodes of one outline dated the same day, each with the context that
 *  says what it is — the same {@link Situated} a zoomed page is built from,
 *  because a day collects nodes from all over the set and a title torn out of
 *  its outline says nothing.
 *
 *  The day view groups by file because a `parent` never crosses one: two nodes
 *  in two outlines have no common ancestry to draw them under, and the file is
 *  the only heading that is true. */
export interface DayGroup {
  readonly file: string
  readonly nodes: ReadonlyArray<Situated>
}

/**
 * Everything dated `day`, grouped by outline.
 *
 * Groups come in path order and a group's nodes in time order — a bare date
 * before any datetime on the same day, because an unspecified time is the day
 * itself and sorts as the earliest thing in it, which plain string comparison
 * on the stored value already gives. Ties break on the line, so the order is
 * the file's own and is the same on every render.
 *
 * An empty array is a real answer: a day with nothing on it is a page that
 * says so, not a page that is missing.
 */
export const datedOn = (derived: Derived, day: string): ReadonlyArray<DayGroup> => {
  const byFile = new Map<string, Array<Dated>>()
  for (const dated of datedNodes(derived)) {
    if (dayOf(dated.date) !== day) continue
    const group = byFile.get(dated.at.file)
    if (group === undefined) byFile.set(dated.at.file, [dated])
    else group.push(dated)
  }

  return [...byFile.entries()]
    .sort(([left], [right]) => compare(left, right))
    .map(([file, nodes]) => ({
      file,
      nodes: nodes.sort(byTime).map((dated) => situate(derived, dated.at)),
    }))
}

const compare = (left: string, right: string): number =>
  left === right ? 0 : left < right ? -1 : 1

const byTime = (left: Dated, right: Dated): number =>
  left.date === right.date
    ? left.at.line - right.at.line
    : compare(left.date, right.date)
