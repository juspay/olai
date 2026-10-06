/**
 * A DAY, AND WHETHER ONE EXISTS — the date a journal writes and the calendar
 * that says no to some of them.
 *
 * A header's date is the first thing that makes a line a transaction, and a
 * date-shaped line whose day is not on the calendar is NOT a transaction: it is
 * a line this reader cannot make sense of, kept as raw text. So the shape and
 * the calendar are one answer here, and the caller gets `null` for either half
 * being wrong rather than a string that looks like a day.
 */

/** How many days a month really has — so `2024-02-31` is not a day, and a
 *  31st is one in March and not in April. February is answered below rather
 *  than by this table, but its slot is here so the index IS the month. */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const daysIn = (year: number, month: number): number =>
  month === 2
    ? (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    : (MONTH_DAYS[month - 1] as number)

/** The shape of a date at the head of a line, before it is judged a real one. */
export const DATE_SHAPE = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/

/** `YYYY-MM-DD` for a written day, or `null` when it names no real one. The
 *  three separators hledger accepts are all one reading here. */
export const iso = (written: string): string | null => {
  const parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(written)
  if (parts === null) return null
  const year = Number(parts[1])
  const month = Number(parts[2])
  const day = Number(parts[3])
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null
  return `${parts[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Whether a token stands alone at the head of a line — the date of a header
 *  ends where the rest of the header begins, and `2024-01-01x` is not a date
 *  with a description. */
export const endsAt = (text: string, at: number): boolean => at >= text.length || /\s/.test(text.charAt(at))
