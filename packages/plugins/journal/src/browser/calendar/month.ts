import { daysOf, isMonth, MONTHS, WEEKDAYS, weekdayOf } from "@olai/format"

export const WEEKDAY_NAMES = WEEKDAYS.map(
  (name) => `${name[0]?.toUpperCase() ?? ""}${name.slice(1)}`,
)

export const WEEKDAY_HEADINGS = WEEKDAY_NAMES.map((name) => name.slice(0, 2))

const WEEK = WEEKDAY_HEADINGS.length

export const monthLabel = (month: string): string =>
  isMonth(month)
    ? `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
    : month

export const shortDay = (date: string): string => {
  const month = MONTHS[Number(date.slice(5, 7)) - 1]
  return isMonth(date.slice(0, 7)) && month !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${month.slice(0, 3)} ${dayNumber(date)}`
    : date
}

export const monthGrid = (month: string): ReadonlyArray<string | null> => {
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

export const dayNumber = (date: string): string => String(Number(date.slice(8, 10)))
