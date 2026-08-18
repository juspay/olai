/**
 * Where the days of a month land on a grid, and what its headings say.
 *
 * The ARITHMETIC is no longer here. It moved down to `@olai/format`'s
 * `calendar.ts` when the query grammar's relative words (`date:last-week`)
 * needed the same two questions this grid does — which weekday a day falls on,
 * and the day before or after one — and that package may not import a client.
 * A second copy down there would have been two answers to which day a week
 * starts on: the grid's columns and a query's span, drawn from different
 * Mondays. So what is left here is what is about DRAWING a month, and every
 * count comes from the one place that counts.
 *
 * Still no `Date` anywhere near it: a month is the same `YYYY-MM` text the rest
 * of the app uses, and the days in the grid are text the format minted.
 *
 * The week starts on MONDAY, and the column order and the lead padding are one
 * fact read off one list — a week that started on Sunday would relabel its own
 * headings.
 */

import { daysOf, isMonth, WEEKDAYS, weekdayOf } from "@olai/format"

/**
 * The weekdays in full, in the order `@olai/format`'s `weekdayOf` counts them
 * — Monday first, capitalised, because these are WORDS ON A SCREEN.
 *
 * DERIVED from the floor's own list rather than written out, which is the
 * comment this declaration used to carry made mechanical: "a second list would
 * be a second Monday". The seven words moved down to `@olai/format`'s
 * `calendar.ts` when the repeat grammar needed them one layer below a client
 * that package may not import — the same journey the weekday ARITHMETIC made
 * before them, and for the same reason. What stayed up here is the pair of
 * decisions that are about drawing a week rather than about naming one: the
 * capital letter, and {@link WEEKDAY_HEADINGS}' two.
 *
 * English, and the outline's rather than the locale's, for the reason
 * {@link monthLabel} gives: these words sit beside ISO dates written by hand,
 * so they are words rather than something that moves with a machine's
 * settings. Read by the editor's `!` widget, which both matches them ("next
 * friday") and prints them.
 */
export const WEEKDAY_NAMES = WEEKDAYS.map(
  (name) => `${name[0]?.toUpperCase() ?? ""}${name.slice(1)}`,
)

/** The weekday headings, in this grid's column order. Two letters, the way a
 *  15rem column can afford — and the first two of the name above rather than a
 *  third list, so a heading cannot come to disagree with the column it is
 *  over. */
export const WEEKDAY_HEADINGS = WEEKDAY_NAMES.map((name) => name.slice(0, 2))

const WEEK = WEEKDAY_HEADINGS.length

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/** "August 2026" — the heading over the grid. English, and the outline's
 *  rather than the locale's: these months sit beside ISO dates written by
 *  hand, so they are words rather than something that moves with a machine's
 *  settings. */
export const monthLabel = (month: string): string =>
  isMonth(month)
    ? `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
    : month

/**
 * One month as whole weeks: an ISO date per day, `null` for the days at either
 * end that belong to another month.
 *
 * The LAYOUT and nothing else. What a cell then says about its day — a dot, a
 * ring, a fill — is the caller's, so the shape has one owner and any number of
 * readings. Text that does not name a month gets an empty grid, because a
 * calendar is not the place to explain a bad address.
 */
export const monthGrid = (month: string): ReadonlyArray<string | null> => {
  // Which column the 1st goes in — and, since it is `null` for text that names
  // no month, whether there is a grid to draw at all. One question, asked of
  // the day the grid would open with.
  const lead = weekdayOf(`${month}-01`)
  if (lead === null) return []

  const cells: Array<string | null> = Array.from({ length: lead }, () => null)
  for (const day of daysOf(month)) cells.push(day)
  const trailing = cells.length % WEEK
  if (trailing !== 0) {
    for (let filled = trailing; filled < WEEK; filled++) cells.push(null)
  }
  return cells
}

/** The number a cell prints: the day of the month, off the date it stands for.
 *  Text in, text out — the grid minted the date, and re-parsing it into
 *  anything would be the first place in this file that needed to. */
export const dayNumber = (date: string): string => String(Number(date.slice(8, 10)))
