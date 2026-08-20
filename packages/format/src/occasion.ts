/**
 * WHICH of a node's fields put it on a day, and WHICH day that is.
 *
 * The floor under every date reading this package has. `./dates.ts` reads a day
 * and a month, `./agenda.ts` reads forward from today, `./filter.ts` answers a
 * `date:` clause, and all three are asking one question first: what dates does
 * this record carry, and what day does each fall on. That question is here, on
 * its own, because `Derived.byDay` (./derive.ts) is the fold of it over a set —
 * and a fold cannot live above the reading it feeds.
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
 * A dated `doing` or `todo` is read by NEITHER. The format allows a date on any
 * of the three marks; a journal is narrower than the format on purpose, and
 * {@link datesOf} is where that line is drawn and argued.
 *
 * Dates are TEXT here, as they are everywhere else in this package: the format
 * validates them as ISO and stores them verbatim, so a day is a prefix and a
 * month is a shorter one. Nothing is parsed into an instant — a date-only
 * `2026-08-10` put through one comes back a datetime, and a calendar has no
 * business being the first place in the codebase that risks it.
 *
 * A LEAF, and deliberately: it names `./node.ts` and nothing else. Everything
 * else in this package that reads a day is layered ON it — including
 * `./derive.ts`, which folds {@link dateInto} over a set — so there is nowhere
 * for a second answer to "what puts a node on a day" to come from.
 */

import { Schema } from "effect"

import {
  isPutAway,
  isRegular,
  type Located,
  type LocatedRegular,
  type RegularNode,
  storedMarker,
} from "./node.ts"

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
 * The TIME a datetime names, `HH:MM`, or nothing for a plain day.
 *
 * The same reading as the two above and written the same way: a slice, never a
 * parse. `2026-09-08T14:00` is a day and a time joined by a `T`, the format
 * validated it as ISO before it was stored, and the five characters after that
 * separator are the ones somebody wrote down. Seconds and an offset are past
 * them and are not a time of day a page has any business printing.
 *
 * It exists because the agenda's spine drops the date pill on a future row —
 * the day it is under has already said the date — and keeps it for the one
 * thing the heading cannot say, which is that this one is at two o'clock
 * (./agenda.ts's `owedFact`).
 */
export const timeOf = (value: string): string | undefined =>
  value.length > DAY && value[DAY] === "T"
    ? value.slice(DAY + 1, DAY + 1 + "HH:MM".length)
    : undefined

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
export const Occasion = Schema.Literals(["date", "done"])
export type Occasion = typeof Occasion.Type

/** A date a record carries, and the field that carried it — the pair, named
 *  once, because everything below passes them together and a row that had one
 *  without the other would be a date nobody could say the meaning of.
 *
 *  A SCHEMA rather than an interface since `vault-in-browser`'s PR 10: a day's
 *  entries and the agenda's stretches are page readings now, so this rides to
 *  the browser rather than being derived there. */
export const Occasioned = Schema.Struct({
  occasion: Occasion,
  /** The value, verbatim: for a node here because it was finished today, the
   *  completion instant, and not whatever it was scheduled for. */
  date: Schema.String,
})
export type Occasioned = typeof Occasioned.Type

/** One of a node's dates, with the node it belongs to — what `Derived.byDay`
 *  holds, and what every reading of that index hands on.
 *
 *  Lifted out of the record because every reader would otherwise re-narrow a
 *  field the fold already decided — and because a node with two dates is two of
 *  these, which is exactly what "on both days" means.
 *
 *  Exported inside the package, never past it: what a consumer gets is the
 *  questions (`./dates.ts`, `./agenda.ts`), already answered. */
export interface Dated extends Occasioned {
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
 * on the SAME day: which occasion that day names (`./dates.ts`'s `datedOn`).
 * `date` first, because the checkbox has already said the work is finished and
 * the day it was scheduled for is not written anywhere else.
 */
export const datesOf = (node: RegularNode): ReadonlyArray<Occasioned> => {
  const dates: Array<Occasioned> = []
  if (node.date !== undefined) dates.push({ occasion: "date", date: node.date })
  if (storedMarker(node) === "done" && typeof node.done === "string") {
    dates.push({ occasion: "done", date: node.done })
  }
  return dates
}

/**
 * One record's dates, filed into `Derived.byDay` under the day each falls
 * on — the whole of how that index is built, in one place, for `./derive.ts`'s
 * `tagInto` reason: the patcher runs this same fold over the records one
 * changed file brought in (`./patch.ts`), and a second spelling of what lands
 * on a day would be a second spelling free to drift from this one.
 *
 * A MIRROR files nothing — it is a placement, and the format gives it no field
 * to carry a date or a mark — so a node on the 10th is on the 10th once,
 * however many places it is shown.
 *
 * WHAT WAS PUT AWAY FILES NOTHING, and this is the one place that says so for
 * every date reading there is (ruled 2026-08-17, human, reversing 2026-08-11):
 * what was put away is drawn on the TRASH PAGE AND NOWHERE ELSE. The earlier
 * rule kept archived work on the day it happened — a journal asks what
 * happened, and archiving is what people do with work after they finish it —
 * and what that cost in practice was the other half of the sentence: a day and
 * the agenda went on drawing rows a reader had already swept off the page,
 * under an `_olai/Trash.olai` heading that explained where they lived without
 * explaining why they were still there. Putting something away is that reader
 * saying they are done looking at it, and the trash is where it is looked at
 * again. Leftover `Archive.olai` is the same exclusion one basename over
 * (human, 2026-08-19): left on disk and stop being read — not trash, so not the
 * trash page's remainder; not live work, so a date in one lights no day.
 * {@link isPutAway} is the pair of predicates as one question.
 *
 * IT IS EXCLUDED AT THE FOLD, which is where this index parts company with
 * `taggedBy` beside it — that one files the trash and leaves it out at each
 * read, because it is an index about what PROSE SAYS and a storage rule inside
 * it would be out of place. This one is an index about what a JOURNAL SHOWS,
 * and a journal does not show what was put away. Both halves of that are load
 * bearing: the exclusion stays spelled ONCE for the day page, the calendar and
 * the agenda's three stretches, which is the property the walk this index
 * replaced was written to hold; and a month with a thousand archived records on
 * it costs a reader nothing, because there is no key for a day nothing live is
 * on.
 *
 * What it does NOT touch is the grammar: `is:trashed` still selects archived
 * nodes at every door, including a `date:` clause beside it, because that
 * reading asks {@link datesOf} of a record rather than asking this index for a
 * day (`./filter.ts`). The default presence is what was taken away; the
 * reachability was not (docs/search.md).
 */
export const dateInto = (
  byDay: Map<string, Array<Dated>>,
  located: Located,
): void => {
  // The narrowing the index's type promises, done once at the fold, exactly as
  // `tagInto` next door does it: a placement carries neither field, so this
  // drops nothing {@link datesOf} would not have answered empty for anyway.
  if (!isRegular(located) || isPutAway(located.file)) return
  for (const dated of datesOf(located.node)) {
    const day = dayOf(dated.date)
    const held = byDay.get(day)
    if (held === undefined) byDay.set(day, [{ at: located, ...dated }])
    else held.push({ at: located, ...dated })
  }
}
