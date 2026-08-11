/**
 * The set, read by day.
 *
 * A node's dates are the whole of the journal. There is no stored year →
 * month hierarchy, no `Daily.jsonl`, no filename anything is special about
 * (docs/format.md; rewrite decision 11): a day is a QUESTION asked of every
 * node in every outline, and the answer is computed here, at view time, from
 * the same records the validator approved.
 *
 * TWO fields put a node on a day, and that is the 2026-08-11 decision: `date`,
 * which is what the node is scheduled for, and a dated `done` —
 * `{"done":"2026-08-11T15:40:03-04:00"}` is a node someone finished at that
 * instant (docs/format.md). A journal that showed what was scheduled but not
 * what was finished would be missing the half of the day that actually
 * happened. So both are read, one node can be on two days, and which of its
 * dates put it on a given day travels with it ({@link Occasion}) rather than
 * being guessed at by whoever draws the row.
 *
 * A dated `doing` or `todo` is read by NEITHER of the questions below. The
 * format allows a date on any of the three marks; a journal is narrower than
 * the format on purpose, and {@link datesOf} is where that line is drawn and
 * argued.
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
 * WHY a node is on a day: which of its two dates put it there.
 *
 * `date` is what the node is scheduled FOR; `done` is when the work was
 * finished. Two different sentences about the same day, and a reader looking at
 * a day page is entitled to know which one they are reading — so the answer is
 * carried rather than inferred from the fields, which is a thing a view could
 * only get wrong.
 *
 * TWO, and not one per mark. `doing` and `todo` may carry dates — the format
 * takes an ISO value on any of the three — and a day page reads NEITHER
 * (resolved 2026-08-11, human, from seeing it live). A journal is a record of
 * what happened and what is coming: finishing is an event, and being scheduled
 * is a plan, but "this was filed on Tuesday" and "this was picked up on
 * Tuesday" are facts about a task's paperwork. Read as days they buried the
 * 11th under every item captured that morning. The values stay legal and stay
 * on disk untouched; these views simply do not ask about them.
 */
export type Occasion = "date" | Extract<Status, "done">

/** A date a record carries, and the field that carried it — the pair, named
 *  once, because everything below passes them together and a row that had one
 *  without the other would be a date nobody could say the meaning of. */
export interface Occasioned {
  readonly occasion: Occasion
  /** The value, verbatim: for a node here because it was finished today, the
   *  completion instant, and not whatever it was scheduled for. */
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
 * The dates one record puts on a calendar, in PRECEDENCE order: what it is
 * scheduled for, then when it was finished.
 *
 * TWO FIELDS ARE READ — `date` and `done` — and this is the whole of the rule
 * (resolved 2026-08-11, human). A dated `doing` or `todo` is a legal record and
 * is passed over here: the format lets any mark carry an ISO value, and what a
 * JOURNAL is for is narrower than what the format allows. A day answers "what
 * is on, and what got done"; "this was filed on Tuesday" and "this was picked
 * up on Tuesday" are facts about a task rather than about the day, and read as
 * days they bury the day's real answer under everything captured that morning.
 * Nothing is written or rewritten to make that true — the values stay on disk,
 * and a reader that wants them can read them off the node.
 *
 * A mark holding `true` is on no day either. It says the state was reached and
 * declines to say when, which is a legal record and is the shape everything
 * written before `done` carried instants still has: there is nothing to put on
 * a calendar, and inventing a day for it would put years of finished work on
 * whatever day it was read.
 *
 * The mark is asked for through {@link storedMarker}, so a set the validator
 * has already condemned — two marks on one record — resolves the same one here
 * as it does in the checkbox: a record carrying `done` AND `todo` is on its
 * `done` day exactly when its checkbox is the one that says done.
 *
 * The order decides exactly one thing, and only for a node whose two dates land
 * on the SAME day: which occasion that day names ({@link datedOn}). `date`
 * first, because the checkbox has already said the work is finished and the day
 * it was scheduled for is not written anywhere else.
 */
const datesOf = (node: RegularNode): ReadonlyArray<Occasioned> => {
  const dates: Array<Occasioned> = []
  if (node.date !== undefined) dates.push({ occasion: "date", date: node.date })
  if (storedMarker(node) === "done" && typeof node.done === "string") {
    dates.push({ occasion: "done", date: node.done })
  }
  return dates
}

/**
 * Every date of every node of the set, in file order, a node contributing one
 * for each date it carries.
 *
 * A MIRROR contributes none — it is a placement, and the format gives it no
 * field to carry a date or a mark — so a node on the 10th is on the 10th once,
 * however many places it is shown.
 *
 * The ARCHIVE is not excluded, and that is a decision rather than an omission
 * (resolved 2026-08-11, human). Blockedness exempts archived work at both ends
 * because nothing can be waiting on something that is over (./derive.ts) — a
 * journal asks a different question. It asks what happened, and archiving is
 * what people do with work AFTER they finish it, so a day that dropped the
 * archived half would be a record of the day with its ending torn out. The
 * node is still under `Archive.jsonl` when the day draws it, and the day view
 * groups by file, so the reader is told where it lives by the same heading
 * that tells them about every other row.
 */
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
export interface DayEntry extends Situated, Occasioned {}

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
  // Keyed by the RECORD, not by its id. Both dates of a node come off one
  // `located`, so this says "one row per record" without borrowing the
  // validator's uniqueness rule — and these walks deliberately run over sets it
  // has condemned (./derive.ts), where two files claiming one id are two nodes
  // a reader still has to be shown.
  const placed = new Set<LocatedRegular>()
  for (const dated of datedNodes(derived)) {
    if (dayOf(dated.date) !== day || placed.has(dated.at)) continue
    placed.add(dated.at)
    const group = byFile.get(dated.at.file)
    if (group === undefined) byFile.set(dated.at.file, [dated])
    else group.push(dated)
  }

  return [...byFile.entries()]
    .sort(([left], [right]) => Order.String(left, right))
    .map(([file, nodes]) => ({
      file,
      // The node, situated, wearing the date that put it here.
      nodes: nodes.sort(byTime).map(({ at, occasion, date }) => ({
        ...situate(derived, at),
        occasion,
        date,
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
