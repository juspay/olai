/**
 * "tomorrow", "next fri", "aug 20" — the days a person can name in words.
 *
 * The `!` widget's whole reading, and it is a PURE function of two strings:
 * what has been typed after the `!`, and what day it is. No clock, no `Date`,
 * no locale — today arrives from the one clock this client has
 * (`../today.tsx`), and everything after that is integer arithmetic in
 * `@olai/format`'s `calendar.ts`, which is the one place this codebase does
 * date arithmetic at all. So this file is unit-tested directly, which is what a
 * grammar like this needs: every one of these phrases is right for most of the
 * year and off by a day in some particular week.
 *
 * ## It is a VOCABULARY and a prefix, not a parser
 *
 * The bulk of it — `today`, `tomorrow`, the seven weekdays, `next <weekday>`,
 * `next week` — is a list of phrases, each of which already knows its day, and
 * what typing does is FILTER that list by prefix. That is the same shape the
 * tag completion has one directory over (`../complete/tags.ts`), and it is why
 * "tom" offers `tomorrow` and "next f" offers `next friday` without a single
 * rule about abbreviations: the abbreviation is just a shorter prefix.
 *
 * Only the forms with a NUMBER in them cannot be a list — `in 3 weeks`,
 * `aug 20`, `2026-09-01` — and those three are read by a regex each, after the
 * list, so an unbounded family of phrases costs three rules rather than an
 * unbounded list.
 *
 * ## Why this is not `chrono-node`
 *
 * A hand-rolled date reader where a focused library exists is a smell, and it
 * was asked. Two things answer it, and the second is the one that decides.
 *
 * A parser turns text into a DATE; what a completion needs is the other
 * direction — every phrase the person might be typing TOWARDS, so `next f`
 * offers `next friday` before it is a date at all. A library that answers
 * "this string means the 28th" cannot enumerate the strings, so the vocabulary
 * would have to exist anyway and the library would only cover the three
 * numbered forms below.
 *
 * And every such library speaks `Date`. This client deliberately does not
 * (`@olai/format`'s `calendar.ts`: `new Date("2026-08-01")` is midnight UTC,
 * which is the 31st of July in half the world), so an instant would have to be
 * converted back to a local day at exactly the seam this whole feature is
 * about — a day is TEXT in this format, and the ten characters that reach the
 * record are supposed to be the ten that were meant.
 *
 * ## What the phrases mean, decided rather than inherited
 *
 * A bare WEEKDAY is the COMING one, strictly after today: typing `friday` on a
 * Friday means the Friday a week away, because a person who meant today has a
 * shorter word for it. `next <weekday>` is that one plus seven — the weekday of
 * the following week — which is the reading every calendar app argues about and
 * the one that makes `friday` and `next friday` two different days rather than
 * a synonym pair. Both are written down here because a reader of the widget
 * cannot tell which was chosen from the row alone, which is why every row shows
 * the DAY it stands for beside the words.
 */

import { isoDate, isRealDay, shiftDay, shiftDayByMonth, weekdayOf } from "@olai/format"

import { MONTH_NAMES, WEEKDAY_NAMES } from "../calendar/month.ts"

/** One day a phrase names. */
export interface Named {
  /** The ISO day — the ten characters the record will hold, verbatim. */
  readonly day: string
  /** The phrase, in full: what the person was typing towards. */
  readonly phrase: string
}

/** How many rows the widget offers. A row's popup is a shortlist, not a
 *  report — and the phrases are ordered nearest-first, so a cut tail is always
 *  the further-away answers. */
const LIMIT = 6

/** How many of them a bare `!` shows. {@link phrases} is written nearest-first
 *  precisely so this can be a count rather than a list. */
const BARE = 3

/**
 * The days `query` could mean, best first — empty when it means none, which is
 * what closes the widget rather than showing an empty box.
 *
 * `today` is the ISO day the reader is standing on, in their own time zone.
 */
export const naturalDays = (query: string, today: string): ReadonlyArray<Named> => {
  const wanted = query.trim().toLowerCase()
  // The bare `!`: the answers a person reaches for without typing, which are
  // the first of the list below rather than a second copy of them — a copy
  // would drift the moment somebody reordered or renamed one.
  if (wanted === "") return phrases(today).slice(0, BARE)
  const found = [
    ...phrases(today).filter((named) => named.phrase.startsWith(wanted)),
    ...counted(wanted, today),
    ...monthDay(wanted, today),
    ...isoDay(wanted),
  ]
  return found.slice(0, LIMIT)
}

/**
 * Every phrase that names a day outright, nearest first.
 *
 * Built per call, because every one of them is relative to today and a list
 * memoised across midnight would be a list that quietly means yesterday.
 */
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

/** The next day that falls on `weekday`, strictly after today — `null` only
 *  for a "today" that is not a day, which is a broken clock rather than a
 *  reachable state. */
const comingWeekday = (today: string, weekday: number): string | null => {
  const standing = weekdayOf(today)
  if (standing === null) return null
  // `|| 7` rather than `% 7`: the same weekday as today is a week away, not
  // today. That is the decision the header states.
  const ahead = (weekday - standing + 7) % 7 || 7
  return shiftDay(today, ahead)
}

/** `in 3 days` / `in 2 weeks` / `in 1 month`, and the singular of each. */
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

/**
 * `aug 20`, `20 aug`, `august 20 2027` — a month and a day, either way round,
 * with the year optional.
 *
 * WITHOUT A YEAR it means the NEXT time that day comes round: `aug 20` typed in
 * September is next August, not one that has already gone. A date widget is
 * used to schedule things, and scheduling into the past is the answer nobody
 * wants offered first.
 */
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
  // A prefix, so `au 20` and `august 20` are the same answer — and the FIRST
  // month it matches, which is why `ma` is March rather than an ambiguity a
  // popup would have to explain.
  const month = MONTH_NAMES.findIndex((name) => name.toLowerCase().startsWith(word))
  if (month === -1) return []
  const day = Number(number)
  // The format's own spelling of a date from parts, so nothing here can
  // zero-pad differently from the counter that checks it below.
  const named = (on: number): string => isoDate(on, month + 1, day)
  // A year said out loud is taken as said — including a `feb 29 2027`, which is
  // not a day and is answered with nothing rather than with a nearby one.
  if (year !== undefined) {
    const said = named(Number(year))
    return isRealDay(said) ? [found(said, month, day)] : []
  }
  const thisYear = Number(today.slice(0, 4))
  // "The next time that day comes round", walked rather than assumed to be
  // this year or the next. `feb 29` is the case that needs the walk: two years
  // in three it is not a day at all, and answering nothing there would be the
  // rule this comment states quietly not applying to the one date people mean
  // it about. Four years is enough for the Gregorian leap rule, and the bound
  // is what makes this a walk rather than a search.
  for (let ahead = 0; ahead <= LEAP_CYCLE; ahead++) {
    const candidate = named(thisYear + ahead)
    if (isRealDay(candidate) && candidate >= today) return [found(candidate, month, day)]
  }
  return []
}

/** How far forward a bare month-and-day is looked for. One Gregorian leap
 *  cycle: the only day that is missing from some years is the 29th of
 *  February, and it comes round inside four — except across a skipped century,
 *  which is why this is eight rather than four. */
const LEAP_CYCLE = 8

const found = (day: string, month: number, number: number): Named => ({
  day,
  phrase: `${MONTH_NAMES[month]} ${number}, ${day.slice(0, 4)}`,
})

/** The ten characters themselves, typed out. The one form where the phrase and
 *  the day are the same string — a person who knows the date does not need it
 *  translated. */
const isoDay = (wanted: string): ReadonlyArray<Named> =>
  isRealDay(wanted) ? [{ day: wanted, phrase: wanted }] : []

/**
 * How a day is printed BESIDE the phrase — `Thu 20 Aug 2026`.
 *
 * Every row shows it, and that is the widget's one non-negotiable: `next
 * friday` is an argument about which Friday, and the only honest way to settle
 * it is to say the date out loud before anybody presses Enter.
 */
export const dayLabel = (day: string): string => {
  const weekday = weekdayOf(day)
  if (weekday === null) return day
  const month = MONTH_NAMES[Number(day.slice(5, 7)) - 1] ?? ""
  return `${WEEKDAY_NAMES[weekday]?.slice(0, 3)} ${Number(day.slice(8, 10))} ${
    month.slice(0, 3)
  } ${day.slice(0, 4)}`
}
