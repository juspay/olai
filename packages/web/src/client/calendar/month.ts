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

/**
 * The weekdays in full, in the order {@link weekdayOf} counts them — Monday
 * first, exactly as {@link WEEKDAYS} abbreviates them.
 *
 * English, and the outline's rather than the locale's, for the reason
 * {@link monthLabel} gives: these words sit beside ISO dates written by hand,
 * so they are words rather than something that moves with a machine's
 * settings. Exported because the editor's `!` widget both reads them ("next
 * friday") and prints them, and a second list would be a second Monday.
 */
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

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

/** A month, taken apart — or `null` for text that does not name one, which is
 *  what `/d/<anything>` can put in front of this. */
interface Month {
  readonly year: number
  readonly month: number
}

const MONTH_SHAPE = /^(\d{4})-(\d{2})$/

const parseMonth = (month: string): Month | null => {
  const match = MONTH_SHAPE.exec(month)
  if (match === null) return null
  const [, year, index] = match as unknown as [string, string, string]
  const numbered = Number(index)
  return numbered >= 1 && numbered <= 12
    ? { year: Number(year), month: numbered }
    : null
}

/**
 * The month a date belongs to, or `null` for text that names no month.
 *
 * The one question a caller has about text it did not mint: `/d/<anything>` is
 * an address a person can type, and the day being read is where the calendar
 * would like to open. Asked and answered in ONE call, because "take the first
 * seven characters" and "is that a month" are two halves of one question, and
 * a caller composing them is a caller that can get the order wrong.
 */
export const monthOfDay = (date: string | undefined): string | null => {
  const month = (date ?? "").slice(0, "YYYY-MM".length)
  return parseMonth(month) === null ? null : month
}

const pad = (value: number): string => String(value).padStart(2, "0")

const monthText = (year: number, month: number): string => `${year}-${pad(month)}`

/** ISO date text from calendar parts. One spelling for the whole client — the
 *  grid mints dates and the clock reads one off the machine, and two of these
 *  would be two chances to zero-pad differently. */
export const isoDate = (year: number, month: number, day: number): string =>
  `${monthText(year, month)}-${pad(day)}`

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

/** A day, taken apart — or `null` for text that does not name one. The grid's
 *  own `parseMonth` plus the day number, checked against the month's length so
 *  `2026-02-30` is not a day. */
interface Day extends Month {
  readonly day: number
}

const DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

const parseDay = (date: string): Day | null => {
  const match = DAY_SHAPE.exec(date)
  if (match === null) return null
  const [, year, month, day] = match as unknown as [string, string, string, string]
  const parsed = parseMonth(`${year}-${month}`)
  if (parsed === null) return null
  const numbered = Number(day)
  return numbered >= 1 && numbered <= daysInMonth(parsed)
    ? { ...parsed, day: numbered }
    : null
}

/** Whether text names a real calendar day — the check `@olai/format`'s `isDay`
 *  makes about SHAPE, plus the month's own length. */
export const isRealDay = (date: string): boolean => parseDay(date) !== null

/**
 * Which weekday a date falls on, 0 = Monday, or `null` for text that names no
 * day.
 *
 * Public because the editor's `!` widget answers "the coming Friday" with it,
 * and that is the same question the grid asks to know which column the 1st
 * goes in. Two of these would be two chances to get Sakamoto's table wrong.
 */
export const weekdayOf = (date: string): number | null => {
  const parsed = parseDay(date)
  return parsed === null ? null : weekday(parsed, parsed.day)
}

/**
 * The day `delta` days away, as ISO text — or the text unchanged when it names
 * no day, which is the rule {@link shiftMonth} already follows: shifting is a
 * way to look around, never a way to end up somewhere that is not a date.
 *
 * Counted by walking whole months rather than by adding milliseconds to an
 * instant, for the reason the header gives: `new Date("2026-08-01")` is
 * midnight UTC, and "tomorrow" for a reader west of Greenwich would come back
 * as today. Never leaving integers is what keeps that impossible.
 */
export const shiftDay = (date: string, delta: number): string => {
  const parsed = parseDay(date)
  if (parsed === null) return date
  let { year, month, day } = parsed
  day += delta
  while (day < 1) {
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
    day += daysInMonth({ year, month })
  }
  for (;;) {
    const length = daysInMonth({ year, month })
    if (day <= length) break
    day -= length
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return isoDate(year, month, day)
}

/**
 * The same day `delta` MONTHS away, clamped to the end of the month it lands
 * in — "next month" from the 31st of January is the 28th of February, because
 * the 31st of February is not a day and refusing to answer would be worse.
 */
export const shiftDayByMonth = (date: string, delta: number): string => {
  const parsed = parseDay(date)
  if (parsed === null) return date
  const shifted = parseMonth(shiftMonth(monthText(parsed.year, parsed.month), delta))
  if (shifted === null) return date
  return isoDate(
    shifted.year,
    shifted.month,
    Math.min(parsed.day, daysInMonth(shifted)),
  )
}

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
    cells.push(isoDate(parsed.year, parsed.month, day))
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
