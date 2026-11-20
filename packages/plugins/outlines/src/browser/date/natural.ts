import {
  comingWeekday,
  isoDate,
  isRealDay,
  MONTHS,
  shiftDay,
  shiftDayByMonth,
  weekdayOf,
  WEEKDAYS,
} from "@olai/format"

const WEEKDAY_NAMES = WEEKDAYS.map(
  (name) => `${name[0]?.toUpperCase() ?? ""}${name.slice(1)}`,
)

export interface Named {
  readonly day: string
  readonly phrase: string
}

const LIMIT = 6

const BARE = 3

export const naturalDays = (query: string, today: string): ReadonlyArray<Named> => {
  const wanted = query.trim().toLowerCase()
  if (wanted === "") return phrases(today).slice(0, BARE)
  const found = [
    ...phrases(today).filter((named) => named.phrase.startsWith(wanted)),
    ...counted(wanted, today),
    ...monthDay(wanted, today),
    ...isoDay(wanted),
  ]
  return found.slice(0, LIMIT)
}

const phrases = (today: string): ReadonlyArray<Named> => {
  const days: Array<Named> = [
    { day: today, phrase: "today" },
    { day: shiftDay(today, 1), phrase: "tomorrow" },
    { day: shiftDay(today, 7), phrase: "next week" },
    { day: shiftDayByMonth(today, 1), phrase: "next month" },
    { day: shiftDay(today, -1), phrase: "yesterday" },
  ]
  for (const [index, name] of WEEKDAY_NAMES.entries()) {
    const coming = comingWeekday(today, index)
    if (coming === null) continue
    days.push({ day: coming, phrase: name.toLowerCase() })
    days.push({ day: shiftDay(coming, 7), phrase: `next ${name.toLowerCase()}` })
  }
  return days
}

const COUNTED = /^in\s+(\d{1,3})\s*(d(?:ays?)?|w(?:eeks?)?|m(?:onths?)?)$/

const counted = (wanted: string, today: string): ReadonlyArray<Named> => {
  const match = COUNTED.exec(wanted)
  if (match === null) return []
  const [, count, unit] = match as unknown as [string, string, string]
  const many = Number(count)
  const plural = (word: string) => `${many} ${word}${many === 1 ? "" : "s"}`
  if (unit.startsWith("m")) {
    return [{ day: shiftDayByMonth(today, many), phrase: `in ${plural("month")}` }]
  }
  const days = unit.startsWith("w") ? many * 7 : many
  return [{
    day: shiftDay(today, days),
    phrase: `in ${plural(unit.startsWith("w") ? "week" : "day")}`,
  }]
}

const MONTH_FIRST = /^([a-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?$/
const DAY_FIRST = /^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?$/

const monthDay = (wanted: string, today: string): ReadonlyArray<Named> => {
  const match = MONTH_FIRST.exec(wanted) ?? DAY_FIRST.exec(wanted)
  if (match === null) return []
  const [, first, second, year] = match as unknown as [
    string,
    string,
    string,
    string | undefined,
  ]
  const [word, number] = /^\d/.test(first) ? [second, first] : [first, second]
  const month = MONTHS.findIndex((name) => name.toLowerCase().startsWith(word))
  if (month === -1) return []
  const day = Number(number)
  const named = (on: number): string => isoDate(on, month + 1, day)
  if (year !== undefined) {
    const said = named(Number(year))
    return isRealDay(said) ? [found(said, month, day)] : []
  }
  const thisYear = Number(today.slice(0, 4))
  for (let ahead = 0; ahead <= LEAP_CYCLE; ahead++) {
    const candidate = named(thisYear + ahead)
    if (isRealDay(candidate) && candidate >= today) return [found(candidate, month, day)]
  }
  return []
}

const LEAP_CYCLE = 8

const found = (day: string, month: number, number: number): Named => ({
  day,
  phrase: `${MONTHS[month]} ${number}, ${day.slice(0, 4)}`,
})

const isoDay = (wanted: string): ReadonlyArray<Named> =>
  isRealDay(wanted) ? [{ day: wanted, phrase: wanted }] : []

export const dayLabel = (day: string): string => {
  const weekday = weekdayOf(day)
  if (weekday === null) return day
  const month = MONTHS[Number(day.slice(5, 7)) - 1] ?? ""
  return `${WEEKDAY_NAMES[weekday]?.slice(0, 3)} ${Number(day.slice(8, 10))} ${
    month.slice(0, 3)
  } ${day.slice(0, 4)}`
}
