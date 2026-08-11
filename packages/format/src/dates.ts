/**
 * The set, read by day.
 *
 * A node's dates are the whole of the journal. There is no stored year →
 * month hierarchy, no `Daily.jsonl`, no filename anything is special about
 * (docs/format.md; rewrite decision 11): a day is a QUESTION asked of every
 * node in every outline, and the answer is computed here, at view time, from
 * the same records the validator approved.
 *
 * EVERY date a node carries counts, and that is the 2026-08-11 decision. The
 * `date` field is what a node is scheduled for; a MARK may carry a date too —
 * `{"done":"2026-08-11T15:40:03-04:00"}` is a node someone finished at that
 * instant (docs/format.md) — and a journal that showed what was scheduled but
 * not what was finished would be missing the half of the day that actually
 * happened. So both are read, one node can be on two days, and which of its
 * dates put it on a given day travels with it ({@link Occasion}) rather than
 * being guessed at by whoever draws the row.
 *
 * Two questions, because there are two surfaces asking:
 *
 *   - {@link datedDays} — which days of one month have anything on them, which
 *     is what puts a dot under a number in the calendar;
 *   - {@link datedOn} — everything on one day, grouped by the outline it lives
 *     in and carrying the ancestry that says what it is ABOUT, which is the
 *     day view.
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

import { Order } from "effect"

import {
  type Derived,
  type Situated,
  situate,
  type Status,
  storedMarker,
} from "./derive.ts"
import { isMirror, type LocatedRegular, type RegularNode } from "./node.ts"

/** How many characters of an ISO value name the day, and the month. A
 *  datetime is a day plus a time, so the day is the prefix they share. */
const DAY = 10
const MONTH = 7

/**
 * The calendar day a date value falls on.
 *
 * A datetime counts for its day: `2026-08-10T14:30` is the 10th, because a
 * person asking what is on the 10th means the meeting at half past two. The
 * value is validated ISO by the time it reaches here (parse.ts), so the day is
 * the first ten characters and no arithmetic is involved.
 */
export const dayOf = (value: string): string => value.slice(0, DAY)

/** The month a day belongs to, `YYYY-MM`. Same rule, three characters shorter. */
export const monthOf = (value: string): string => value.slice(0, MONTH)

/**
 * WHY a node is on a day: which of its dates put it there.
 *
 * `date` is what the node is scheduled for; a mark's date is when that state
 * was REACHED. Two different sentences about the same day, and a reader
 * looking at a day page is entitled to know which one they are reading — so
 * the answer is carried rather than inferred from the fields, which is a thing
 * a view could only get wrong.
 *
 * The marks are read off {@link Status} rather than listed again: a fourth
 * mark should not be a date this module quietly ignores.
 */
export type Occasion = "date" | Status

/** A date a record carries, and the field that carried it. */
interface Occasioned {
  readonly occasion: Occasion
  readonly date: string
}

/** One of a node's dates, with the node it belongs to. Lifted out of the
 *  record because every function below would otherwise re-narrow a field this
 *  one walk already decided — and because a node with two dates is two of
 *  these, which is exactly what "on both days" means. */
interface Dated extends Occasioned {
  readonly at: LocatedRegular
}

/**
 * Every date one record carries, in PRECEDENCE order: what it is scheduled
 * for, then the date on the mark it stores.
 *
 * A mark holding `true` is on no day at all. It says the state was reached and
 * declines to say when, which is a legal record (docs/format.md) and is the
 * shape everything written before the marks carried instants still has: there
 * is nothing to put on a calendar, and inventing a day for it would put years
 * of finished work on whatever day it was read.
 *
 * The mark is asked for through {@link storedMarker}, so a set the validator
 * has already condemned — two marks on one record — resolves the same one here
 * as it does in the checkbox.
 *
 * The order decides exactly one thing, and only for a node whose dates land on
 * the SAME day: which occasion that day names ({@link datedOn}). `date` first,
 * because a mark's kind is already on the row in its checkbox and the day it
 * was scheduled for is not written anywhere else.
 */
const datesOf = (node: RegularNode): ReadonlyArray<Occasioned> => {
  const dates: Array<Occasioned> = []
  if (node.date !== undefined) dates.push({ occasion: "date", date: node.date })
  const mark = storedMarker(node)
  const marked = mark === undefined ? undefined : node[mark]
  if (mark !== undefined && typeof marked === "string") {
    dates.push({ occasion: mark, date: marked })
  }
  return dates
}

/** Every date of every node of the set, in file order, a node contributing one
 *  for each date it carries. A mirror contributes none — it is a placement,
 *  and the format gives it no field to carry a date or a mark — so a node on
 *  the 10th is on the 10th once, however many places it is shown. */
const datedNodes = (derived: Derived): ReadonlyArray<Dated> =>
  derived.nodes.flatMap((located) =>
    isMirror(located.node) ? [] : datesOf(located.node).map((dated) => ({
      at: located as LocatedRegular,
      ...dated,
    }))
  )

/**
 * The days of `month` (`YYYY-MM`) that have at least one node on them.
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

/**
 * One node on a day: everything a zoomed page knows about it — the same {@link
 * Situated} that page is built from, because a day collects nodes from all
 * over the set and a title torn out of its outline says nothing — plus which
 * of its dates put it here.
 */
export interface DayEntry extends Situated {
  /** Which of the node's dates this row is about. */
  readonly occasion: Occasion
  /** That date, verbatim — the one to show, which for a node on this day
   *  because it was finished on it is the completion instant and not whatever
   *  it was scheduled for. */
  readonly date: string
}

/** The nodes of one outline on the same day.
 *
 *  The day view groups by file because a `parent` never crosses one: two nodes
 *  in two outlines have no common ancestry to draw them under, and the file is
 *  the only heading that is true. */
export interface DayGroup {
  readonly file: string
  readonly nodes: ReadonlyArray<DayEntry>
}

/**
 * Everything on `day`, grouped by outline.
 *
 * Groups come in path order and a group's nodes in time order — a bare date
 * before any datetime on the same day, because an unspecified time is the day
 * itself and sorts as the earliest thing in it, which plain string comparison
 * on the stored value already gives. Ties break on the line, so the order is
 * the file's own and is the same on every render.
 *
 * ONE ROW PER NODE. A node scheduled for a day and finished on it carries two
 * dates that are the same day, and it is one thing that happened: the first in
 * {@link datesOf}'s precedence wins the row and names the occasion. Two rows
 * for one node would be the day claiming there were two.
 *
 * An empty array is a real answer: a day with nothing on it is a page that
 * says so, not a page that is missing.
 */
export const datedOn = (derived: Derived, day: string): ReadonlyArray<DayGroup> => {
  const byFile = new Map<string, Array<Dated>>()
  const placed = new Set<string>()
  for (const dated of datedNodes(derived)) {
    if (dayOf(dated.date) !== day || placed.has(dated.at.node.id)) continue
    placed.add(dated.at.node.id)
    const group = byFile.get(dated.at.file)
    if (group === undefined) byFile.set(dated.at.file, [dated])
    else group.push(dated)
  }

  return [...byFile.entries()]
    .sort(([left], [right]) => Order.String(left, right))
    .map(([file, nodes]) => ({
      file,
      nodes: nodes.sort(byTime).map((dated) => ({
        ...situate(derived, dated.at),
        occasion: dated.occasion,
        date: dated.date,
      })),
    }))
}

/** Code-point order on the stored text, ties on the line — the same rule the
 *  error report sorts by (./errors.ts), and effect's own comparator rather
 *  than a hand-rolled one: `localeCompare` would put the same day in two
 *  orders on two machines. */
const byTime = (left: Dated, right: Dated): number =>
  left.date === right.date
    ? left.at.line - right.at.line
    : Order.String(left.date, right.date)
