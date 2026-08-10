/**
 * Where the days of a month land on a grid, and which month is next to it.
 *
 * The only arithmetic in this codebase that is not a string comparison, and it
 * is here because a calendar cannot be drawn without it: something has to say
 * which column the 1st falls in and how many days follow it. It is still not a
 * date LIBRARY — no value is parsed into an instant, nothing reads a clock,
 * and a month is the same `YYYY-MM` text everywhere else in the app uses
 * (docs/architecture.md: dates are validated as text, because a writer must
 * reproduce what it read verbatim).
 *
 * Pure, so it is unit-tested directly: a grid is exactly the kind of thing
 * that is off by one for four months of the year and right for the rest.
 *
 * The week starts on MONDAY, and the column order and the lead padding are one
 * fact read off one list — a week that started on Sunday would relabel its own
 * headings.
 */

/** The weekday headings, in this grid's column order. Two letters, the way a
 *  15rem column can afford. */
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const

const WEEK = WEEKDAYS.length

const MONTH_NAMES = [
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

/** A month, taken apart — or `null` for text that does not name one, which is
 *  what `/d/<anything>` can put in front of this. */
interface Month {
  readonly year: number
  readonly month: number
}

const MONTH_SHAPE = /^(\d{4})-(\d{2})$/

export const parseMonth = (month: string): Month | null => {
  const match = MONTH_SHAPE.exec(month)
  if (match === null) return null
  const [, year, index] = match as unknown as [string, string, string]
  const numbered = Number(index)
  return numbered >= 1 && numbered <= 12
    ? { year: Number(year), month: numbered }
    : null
}

/** Is this text a month? The one question a caller has before it trusts a
 *  `YYYY-MM` it did not mint itself. */
export const isMonth = (month: string): boolean => parseMonth(month) !== null

const pad = (value: number): string => String(value).padStart(2, "0")

const monthText = (year: number, month: number): string => `${year}-${pad(month)}`

/**
 * The month `delta` away — what a prev/next button is.
 *
 * Counted in months since year zero, so December + 1 is January of the next
 * year without a special case, and a month this cannot read comes back
 * unchanged: paging is a way to look around, never a way to end up somewhere
 * that is not a month at all.
 */
export const shiftMonth = (month: string, delta: number): string => {
  const parsed = parseMonth(month)
  if (parsed === null) return month
  const total = parsed.year * 12 + (parsed.month - 1) + delta
  return monthText(Math.floor(total / 12), (total % 12) + 1)
}

/** "August 2026" — the heading over the grid. English, and the outline's
 *  rather than the locale's: these months sit beside ISO dates written by
 *  hand, so they are words rather than something that moves with a machine's
 *  settings. */
export const monthLabel = (month: string): string => {
  const parsed = parseMonth(month)
  return parsed === null
    ? month
    : `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`
}

/** A leap year is the Gregorian rule, written out: every fourth, except every
 *  hundredth, except every four-hundredth. */
const isLeap = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const daysInMonth = ({ year, month }: Month): number =>
  month === 2 && isLeap(year) ? 29 : LENGTHS[month - 1]!

/**
 * Which day of the week a date falls on, 0 = Monday, as this grid counts them.
 *
 * Sakamoto's method — a table of month offsets and the Gregorian leap rule,
 * which is the whole of what "which weekday" needs. A `Date` would do it too
 * and would drag a time zone in with it: `new Date("2026-08-01")` is midnight
 * UTC, which is the 31st of July in half the world, and a calendar that
 * shifted a column for readers west of Greenwich is exactly the bug this
 * avoids by never leaving integers.
 */
const OFFSETS = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const

const weekday = ({ year, month }: Month, day: number): number => {
  const shifted = month < 3 ? year - 1 : year
  const sunday =
    (shifted +
      Math.floor(shifted / 4) -
      Math.floor(shifted / 100) +
      Math.floor(shifted / 400) +
      OFFSETS[month - 1]! +
      day) %
    7
  // Sakamoto counts from Sunday; this grid counts from Monday.
  return (sunday + 6) % 7
}

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
  const parsed = parseMonth(month)
  if (parsed === null) return []

  const lead = weekday(parsed, 1)
  const cells: Array<string | null> = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth(parsed); day++) {
    cells.push(`${month}-${pad(day)}`)
  }
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
