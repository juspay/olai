interface Month {
  readonly year: number
  readonly month: number
}

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

const pad = (value: number, width = 2): string => String(value).padStart(width, "0")

const monthText = (year: number, month: number): string =>
  `${pad(year, 4)}-${pad(month)}`

export const isoDate = (year: number, month: number, day: number): string =>
  `${monthText(year, month)}-${pad(day)}`

export const isMonth = (month: string): boolean => parseMonth(month) !== null

export const isRealDay = (date: string): boolean => parseDay(date) !== null

export const monthOfDay = (date: string | undefined): string | null => {
  const month = (date ?? "").slice(0, "YYYY-MM".length)
  return parseMonth(month) === null ? null : month
}

const isLeap = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

const daysIn = ({ year, month }: Month): number =>
  month === 2 && isLeap(year) ? 29 : LENGTHS[month - 1]!

export const daysOf = (month: string): ReadonlyArray<string> => {
  const parsed = parseMonth(month)
  if (parsed === null) return []
  const days: Array<string> = []
  for (let day = 1; day <= daysIn(parsed); day++) {
    days.push(isoDate(parsed.year, parsed.month, day))
  }
  return days
}

const stepMonth = ({ year, month }: Month, delta: number): Month => {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export const shiftMonth = (month: string, delta: number): string => {
  const parsed = parseMonth(month)
  if (parsed === null) return month
  const shifted = stepMonth(parsed, delta)
  return monthText(shifted.year, shifted.month)
}

const OFFSETS = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export const MONTHS = [
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
  return (sunday + 6) % 7
}

export const comingWeekday = (date: string, weekday: number): string | null => {
  const standing = weekdayOf(date)
  if (standing === null) return null
  return shiftDay(date, (weekday - standing + 7) % 7 || 7)
}

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

export const shiftDayByMonth = (date: string, delta: number): string => {
  const parsed = parseDay(date)
  if (parsed === null) return date
  const shifted = stepMonth(parsed, delta)
  return isoDate(shifted.year, shifted.month, Math.min(parsed.day, daysIn(shifted)))
}

const TIME_SHAPE = /^T(\d{2}):(\d{2})(?::(\d{2}))?(.*)$/

const MIDNIGHT = "T00:00:00"

const DAY_MINUTES = 24 * 60

export const shiftMinutes = (at: string, delta: number): string | null => {
  const day = at.slice(0, "YYYY-MM-DD".length)
  const parsed = parseDay(day)
  if (parsed === null) return null
  const face = TIME_SHAPE.exec(at.slice(day.length) || MIDNIGHT)
  if (face === null) return null
  const [, hours, minutes, seconds, tail] = face as unknown as [
    string,
    string,
    string,
    string | undefined,
    string,
  ]
  const counted = Number(hours) * 60 + Number(minutes) + delta
  const borrowed = Math.floor(counted / DAY_MINUTES)
  const onFace = counted - borrowed * DAY_MINUTES
  const landed = dayOfSerial(serialOf(parsed) + borrowed)
  const spelled = isoDate(landed.year, landed.month, landed.day)
  if (parseDay(spelled) === null) return null
  return `${spelled}T${pad(Math.floor(onFace / 60))}:${pad(onFace % 60)}:${
    seconds ?? "00"
  }${tail}`
}

export const daysBetween = (from: string, to: string): number | null => {
  const start = parseDay(from)
  const end = parseDay(to)
  if (start === null || end === null) return null
  return serialOf(end) - serialOf(start)
}

const serialOf = ({ year, month, day }: Day): number => {
  const shifted = year - (month <= 2 ? 1 : 0)
  const era = Math.floor(shifted / 400)
  const yearOfEra = shifted - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra
}

const dayOfSerial = (serial: number): Day => {
  const era = Math.floor(serial / 146097)
  const dayOfEra = serial - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) / 365,
  )
  const dayOfYear = dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const marchMonth = Math.floor((5 * dayOfYear + 2) / 153)
  const month = marchMonth < 10 ? marchMonth + 3 : marchMonth - 9
  return {
    year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
    month,
    day: dayOfYear - Math.floor((153 * marchMonth + 2) / 5) + 1,
  }
}
