/**
 * The one place a date is COUNTED rather than compared.
 *
 * Everything else about dates in this package is text (./dates.ts): a value is
 * validated as ISO and stored verbatim, a day is a ten-character prefix, a
 * month is a shorter one, and a range is two string comparisons. That stance is
 * deliberate and it holds — but two readings genuinely cannot be answered by
 * comparing text, and both are here:
 *
 *   - WHICH WEEKDAY a day falls on, which is what puts the 1st in its column of
 *     a calendar grid and what makes `date:this-week` a Monday-to-Sunday span
 *     (./filter.ts);
 *   - THE DAY BEFORE OR AFTER one, which needs the length of a month and the
 *     Gregorian leap rule.
 *
 * It is not a date LIBRARY and it never leaves integers. Nothing is parsed into
 * an instant: `new Date("2026-08-01")` is midnight UTC, which is the 31st of
 * July in half the world, so a "yesterday" computed through one would come back
 * as today for every reader west of Greenwich. A day in this format is TEXT —
 * the ten characters that reach the record are the ten that were meant — and
 * arithmetic over `{year, month, day}` is what keeps that true.
 *
 * IT LIVED IN THE BROWSER, in `@olai/web`'s `calendar/month.ts`, where the
 * calendar grid needed it and its header called it the only arithmetic in the
 * codebase that was not a string comparison. That claim is what moved it: the
 * query grammar's relative words (`date:last-week`) need the same two
 * questions, and `@olai/format` may not import a client. Writing a second copy
 * down here would be two answers to "which day does this week start on" — the
 * exact drift one matcher for four doors exists to make impossible. So the
 * arithmetic came down to the floor both stand on, and what stayed up there is
 * everything that is about DRAWING a month: the column headings, the English
 * month names, the grid's padding.
 *
 * Pure, and unit-tested directly: a grid is exactly the kind of thing that is
 * off by one for four months of the year and right for the rest.
 */

/** A month, taken apart — or `null` for text that does not name one, which is
 *  what `/d/<anything>` and a query's `date:` value can both put in front of
 *  this. */
interface Month {
  readonly year: number
  readonly month: number
}

/** A day, taken apart. The month plus a day number checked against that
 *  month's own length, so `2026-02-30` is not a day here — the one place in
 *  this package that CAN tell that from `2026-01-30`, because it is the one
 *  place holding a calendar. */
interface Day extends Month {
  readonly day: number
}

const MONTH_SHAPE = /^(\d{4})-(\d{2})$/
const DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

const parseMonth = (month: string): Month | null => {
  const match = MONTH_SHAPE.exec(month)
  if (match === null) return null
  const [, year, index] = match as unknown as [string, string, string]
  const numbered = Number(index)
  return numbered >= 1 && numbered <= 12
    ? { year: Number(year), month: numbered }
    : null
}

const parseDay = (date: string): Day | null => {
  const match = DAY_SHAPE.exec(date)
  if (match === null) return null
  const [, year, month, day] = match as unknown as [string, string, string, string]
  const parsed = parseMonth(`${year}-${month}`)
  if (parsed === null) return null
  const numbered = Number(day)
  return numbered >= 1 && numbered <= daysIn(parsed)
    ? { ...parsed, day: numbered }
    : null
}

const pad = (value: number): string => String(value).padStart(2, "0")

const monthText = (year: number, month: number): string => `${year}-${pad(month)}`

/** ISO date text from calendar parts. One spelling for the whole codebase —
 *  the grid mints dates, the browser's clock reads one off the machine, and
 *  two of these would be two chances to zero-pad differently. */
export const isoDate = (year: number, month: number, day: number): string =>
  `${monthText(year, month)}-${pad(day)}`

/** Whether text names a real calendar month, `YYYY-MM`. */
export const isMonth = (month: string): boolean => parseMonth(month) !== null

/** Whether text names a real calendar day — the check ./dates.ts's `isDay`
 *  makes about SHAPE, plus the month's own length. */
export const isRealDay = (date: string): boolean => parseDay(date) !== null

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

/** A leap year is the Gregorian rule, written out: every fourth, except every
 *  hundredth, except every four-hundredth. */
const isLeap = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const daysIn = ({ year, month }: Month): number =>
  month === 2 && isLeap(year) ? 29 : LENGTHS[month - 1]!

/**
 * Every day of a month, in order — empty for text that names no month.
 *
 * The shape a grid is padded out of, and the answer to "how long is February"
 * without exporting a calendar's insides: a caller that wanted the LENGTH
 * wanted the days.
 */
export const daysOf = (month: string): ReadonlyArray<string> => {
  const parsed = parseMonth(month)
  if (parsed === null) return []
  const days: Array<string> = []
  for (let day = 1; day <= daysIn(parsed); day++) {
    days.push(isoDate(parsed.year, parsed.month, day))
  }
  return days
}

/** The month `delta` away, as parts. The ONE spelling of "December plus one is
 *  next January": counted in months since year zero, so no branch on 12 or 1
 *  exists anywhere and there is nothing for three copies of it to disagree
 *  about. Everything here that crosses a month boundary goes through it. */
const stepMonth = ({ year, month }: Month, delta: number): Month => {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

/**
 * The month `delta` away — what a prev/next button is, and what `date:
 * last-month` counts.
 *
 * A month this cannot read comes back unchanged: shifting is a way to look
 * around, never a way to end up somewhere that is not a month at all.
 */
export const shiftMonth = (month: string, delta: number): string => {
  const parsed = parseMonth(month)
  if (parsed === null) return month
  const shifted = stepMonth(parsed, delta)
  return monthText(shifted.year, shifted.month)
}

/**
 * Which day of the week a date falls on, 0 = MONDAY, or `null` for text that
 * names no day.
 *
 * Sakamoto's method — a table of month offsets and the Gregorian leap rule,
 * which is the whole of what "which weekday" needs.
 *
 * MONDAY IS THE WEEK'S FIRST DAY, and this is the only place that says so: the
 * calendar grid's column order is read off this count, and so is the span
 * `date:this-week` selects. One convention, one implementation — a second week
 * would be a query and a calendar disagreeing about which Sunday a Sunday
 * belongs to.
 */
const OFFSETS = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const

export const weekdayOf = (date: string): number | null => {
  const parsed = parseDay(date)
  if (parsed === null) return null
  const { year, month, day } = parsed
  const shifted = month < 3 ? year - 1 : year
  const sunday =
    (shifted +
      Math.floor(shifted / 4) -
      Math.floor(shifted / 100) +
      Math.floor(shifted / 400) +
      OFFSETS[month - 1]! +
      day) %
    7
  // Sakamoto counts from Sunday; everything here counts from Monday.
  return (sunday + 6) % 7
}

/**
 * The day `delta` days away, as ISO text — or the text unchanged when it names
 * no day, which is the rule {@link shiftMonth} already follows.
 *
 * Counted by walking whole months rather than by adding milliseconds to an
 * instant, for the reason the header gives: never leaving integers is what
 * keeps a time zone out of "yesterday".
 */
export const shiftDay = (date: string, delta: number): string => {
  const parsed = parseDay(date)
  if (parsed === null) return date
  let at: Month = parsed
  let day = parsed.day + delta
  while (day < 1) {
    at = stepMonth(at, -1)
    day += daysIn(at)
  }
  while (day > daysIn(at)) {
    day -= daysIn(at)
    at = stepMonth(at, 1)
  }
  return isoDate(at.year, at.month, day)
}

/**
 * The same day `delta` MONTHS away, clamped to the end of the month it lands
 * in — "next month" from the 31st of January is the 28th of February, because
 * the 31st of February is not a day and refusing to answer would be worse.
 */
export const shiftDayByMonth = (date: string, delta: number): string => {
  const parsed = parseDay(date)
  if (parsed === null) return date
  const shifted = stepMonth(parsed, delta)
  return isoDate(shifted.year, shifted.month, Math.min(parsed.day, daysIn(shifted)))
}
