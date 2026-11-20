import { comingWeekday, shiftDay, shiftDayByMonth, WEEKDAYS } from "./calendar.ts"
import { dayOf } from "./occasion.ts"

export type Repeat =
  | { readonly every: "day" }
  | { readonly every: "week"; readonly weekday: number }
  | { readonly every: "month" }
  | { readonly every: "year" }

export const printRepeat = (rule: Repeat): string =>
  rule.every === "week"
    ? `every week on ${WEEKDAYS[rule.weekday] ?? WEEKDAYS[0]}`
    : `every ${rule.every}`

const PLAIN = {
  day: { every: "day" },
  month: { every: "month" },
  year: { every: "year" },
} as const satisfies Record<string, Repeat>

export const REPEAT_RULES: ReadonlyArray<string> = [
  printRepeat(PLAIN.day),
  ...WEEKDAYS.map((_, weekday) => printRepeat({ every: "week", weekday })),
  printRepeat(PLAIN.month),
  printRepeat(PLAIN.year),
]

export const REPEAT_GRAMMAR =
  "`every day`, `every week on <weekday>`, `every month` or `every year`"

export const parseRepeat = (text: string): Repeat | undefined => {
  const words = text.trim().toLowerCase().split(/\s+/)
  if (words[0] !== "every") return undefined
  const rest = words.slice(1)
  if (rest.length === 1) {
    const word = rest[0] as string
    // `Object.hasOwn` before the lookup, not for tidiness: a bare index on an
    // object literal answers `every constructor` with a function off the
    // prototype, which a `Repeat | undefined` cast would wave straight through.
    const plain = Object.hasOwn(PLAIN, word)
      ? (PLAIN as Record<string, Repeat>)[word]
      : undefined
    return plain ?? weekOf(word)
  }
  if (rest.length === 3 && rest[0] === "week" && rest[1] === "on") {
    return weekOf(rest[2] as string)
  }
  return undefined
}

const weekOf = (word: string): Repeat | undefined => {
  const weekday = WEEKDAYS.findIndex((name) =>
    name === word || (word.length === 3 && name.startsWith(word))
  )
  return weekday === -1 ? undefined : { every: "week", weekday }
}

export const canonicalRepeat = (text: string): string | undefined => {
  const rule = parseRepeat(text)
  return rule === undefined ? undefined : printRepeat(rule)
}

export const nextAfter = (rule: Repeat, date: string): string => {
  const day = dayOf(date)
  switch (rule.every) {
    case "day":
      return shiftDay(day, 1)
    case "week":
      return comingWeekday(day, rule.weekday) ?? day
    case "month":
      return shiftDayByMonth(day, 1)
    case "year":
      return shiftDayByMonth(day, 12)
  }
}

export const nextOccurrence = (repeat: string, date: string): string | undefined => {
  const rule = parseRepeat(repeat)
  return rule === undefined ? undefined : nextAfter(rule, date)
}
