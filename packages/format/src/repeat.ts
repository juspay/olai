/**
 * The repeat rule: a dated node that comes back, spelled in the file.
 *
 * A node's `repeat` is TEXT, and the text is the grammar — `every day`, `every
 * week on monday`, `every month`, `every year`, and nothing else. It is stored
 * the way a person would write it because a `.olai` is read by people: a
 * cron field (`0 0 * * 1`) says the same thing in a dialect that has to be
 * learned, and the moment a dialect exists the pressure is to grow it. Four
 * spellings is a vocabulary; five fields with numbers in them is a language,
 * and this format does not want one. What is deliberately NOT here, each of
 * them a real feature somebody will ask for: intervals (`every 2 weeks`), end
 * dates, counts, several weekdays, days of the month, and the org-mode
 * catch-up modifiers ({@link nextAfter} argues the last of those).
 *
 * ## The rule rides the node that is NEXT
 *
 * A recurrence is a CHAIN of occurrences and exactly one of them is pending;
 * the rule lives on that one. Completing an occurrence hands the rule forward
 * to the occurrence it spawns (`@olai/ops`' `planMark`), so a finished node is
 * a plain dated record of a thing that happened — it does not go on claiming
 * to repeat, and the set never holds two live heads of one recurrence.
 *
 * Every question about the feature falls out of that one sentence, which is
 * why it is written here rather than at the writer: un-doing a completion
 * cannot un-spawn (the occurrence is owed whatever anyone says about the one
 * before it), and re-doing it spawns nothing (the node no longer carries a
 * rule), so the churn a stateful "have I already spawned this?" flag would
 * have had to remember is not representable.
 *
 * ## A rule needs a date
 *
 * `every week on monday` with nothing to repeat FROM answers no question at
 * all, so `repeat` without `date` is refused per line, beside "at most one
 * mark" (./parse.ts). That keeps {@link nextAfter} total over the records the
 * validator approves: every rule on disk has an anchor.
 *
 * ## Text in, text out
 *
 * This module is the one place that reads or writes the spelling. Everything
 * else — the planner, the two pickers, the badge — holds either the TEXT the
 * record carries or the {@link Repeat} this parses it into, and neither of
 * them re-derives the other's shape. {@link nextAfter} counts with
 * ./calendar.ts, which is the one place in this package a date is counted
 * rather than compared; nothing here parses a date into an instant.
 */

import { comingWeekday, shiftDay, shiftDayByMonth, WEEKDAYS } from "./calendar.ts"
import { dayOf } from "./dates.ts"

/**
 * A rule, taken apart.
 *
 * FOUR ARMS rather than one struct with an optional `weekday`, for the reason
 * the format has two record shapes rather than one with an optional `mirror`:
 * `{every: "day", weekday: 3}` is a value nobody can say the meaning of, and a
 * union makes it unrepresentable. `weekday` is a number and not a name because
 * that is what {@link weekdayOf} answers and what the arithmetic below counts
 * with; the NAME is a spelling, and spellings live in {@link printRepeat}.
 */
export type Repeat =
  | { readonly every: "day" }
  | { readonly every: "week"; readonly weekday: number }
  | { readonly every: "month" }
  | { readonly every: "year" }

/** The canonical spelling of a rule — what a write puts on disk, and what
 *  {@link parseRepeat} answers about. ONE direction of the round trip; the
 *  other is that function, and `./repeat.test.ts` holds them to each other. */
export const printRepeat = (rule: Repeat): string =>
  rule.every === "week"
    ? `every week on ${WEEKDAYS[rule.weekday] ?? WEEKDAYS[0]}`
    : `every ${rule.every}`

/** Every rule that has no weekday in it, keyed by the word after `every`. A
 *  table rather than three comparisons, so the grammar is a LIST — which is
 *  what makes {@link REPEAT_RULES} below readable off it rather than written
 *  out a second time. */
const PLAIN = {
  day: { every: "day" },
  month: { every: "month" },
  year: { every: "year" },
} as const satisfies Record<string, Repeat>

/**
 * The whole grammar, as the canonical spellings of every rule it holds — ten
 * of them, and there will not be an eleventh without an edit to this file.
 *
 * Read off {@link PLAIN} and {@link WEEKDAYS} rather than written out, so a
 * grammar that grows a rule grows this list with it. It is what the pickers
 * offer and what a refusal names: a person choosing from a list and an agent
 * reading a tool description are looking at the same ten strings.
 */
export const REPEAT_RULES: ReadonlyArray<string> = [
  printRepeat(PLAIN.day),
  ...WEEKDAYS.map((_, weekday) => printRepeat({ every: "week", weekday })),
  printRepeat(PLAIN.month),
  printRepeat(PLAIN.year),
]

/** The grammar in one sentence, for the refusals and the tool descriptions
 *  that have to quote it. Here rather than at each of them, because a sentence
 *  spelled twice is two grammars the day one of them grows a rule. */
export const REPEAT_GRAMMAR =
  "`every day`, `every week on <weekday>`, `every month` or `every year`"

/**
 * The rule this text names, or `undefined` for text that names none.
 *
 * FORGIVING ABOUT SPELLING, strict about grammar. Case is folded and runs of
 * whitespace collapse, because it is a sentence a person types; `mon` is
 * `monday`, because the roadmap wrote it that way and a three-letter weekday
 * is not a second grammar. Everything else — an interval, a second weekday, a
 * day of the month — is not this vocabulary and comes back `undefined` rather
 * than being guessed at, which is what makes the file's text and the rule the
 * same thing.
 */
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
  // `every week on <weekday>` — the one three-word form, and `on` is required:
  // `every week monday` is a sentence this grammar does not have.
  if (rest.length === 3 && rest[0] === "week" && rest[1] === "on") {
    return weekOf(rest[2] as string)
  }
  return undefined
}

/** `every <weekday>` and the tail of `every week on <weekday>`, which are the
 *  same word read at two places. Abbreviations are the first three letters and
 *  nothing shorter: `s` names two days, and a grammar that guessed between
 *  them would be a rule whose meaning depends on a table nobody can see. */
const weekOf = (word: string): Repeat | undefined => {
  const weekday = WEEKDAYS.findIndex((name) =>
    name === word || (word.length === 3 && name.startsWith(word))
  )
  return weekday === -1 ? undefined : { every: "week", weekday }
}

/**
 * The CANONICAL spelling of whatever rule this text names, or `undefined` for
 * text that names none — the round trip in one call, and the one question
 * anything outside this module asks about a rule's words.
 *
 * TWO CALLERS, and they are the two halves of "reading is forgiving about
 * spelling and a write stores the canonical one" (docs/format.md): the per-line
 * rule asks it to find out whether a line holds a rule at all (./parse.ts), and
 * `set_repeat` asks it for the text to actually store (`@olai/ops`' planner).
 * A third caller is the picker, which seeds its list from the rule a node
 * carries however that node came by it.
 *
 * WHY A WRITE CANONICALISES, when a date does not: `every monday` and `every
 * week on monday` are the same rule with nothing to tell them apart, where
 * `2026-08-10` and `2026-08-10T09:00` are two different records. This format's
 * whole bet is that a line-based git merge is safe, and that rests on two files
 * meaning the same thing not differing byte for byte — a conflict over which
 * way somebody spelled Monday is a conflict about nothing (docs/format.md's
 * Writing). Reading stays forgiving, and a spelling already on disk is left
 * exactly as it was found until somebody writes that field, which is the rule
 * `done: true` keeps beside the instants olai now stamps.
 */
export const canonicalRepeat = (text: string): string | undefined => {
  const rule = parseRepeat(text)
  return rule === undefined ? undefined : printRepeat(rule)
}

/**
 * The next occurrence: the first day the rule names STRICTLY AFTER `date`.
 *
 * The rhythm is the FILE's and never the clock's, and that is the decision
 * this function is. Completing something three weeks late spawns the
 * occurrence one period on — which may itself be in the past, and is, because
 * it genuinely was owed. The alternative is a catch-up rule that skips forward
 * to the first occurrence after TODAY, and it needs two things this refuses to
 * take: a clock inside a derivation (the answer would change with the machine
 * it ran on, which is the argument ./agenda.ts already makes about `today`),
 * and a second modifier in the grammar to choose between the two readings —
 * org-mode's `+1w` against `.+1w`, which is the cron dialect arriving one
 * character at a time. One rule, one meaning; what a person does with a
 * backlog of missed occurrences is complete them or clear them, and either way
 * the file says what happened.
 *
 * TOTAL over what the validator approves: a `repeat` on disk has a `date`
 * beside it, and a `date` is ISO. Handed something else — a datetime, whose
 * time this drops the way every other reading of a date does, or text that is
 * no day at all — it answers the day it was given, and it answers that by
 * DELEGATION rather than by a guard of its own: ./calendar.ts's shifts hand
 * back text they cannot count with, unchanged, which is that module's own rule
 * ("shifting is a way to look around, never a way to end up somewhere that is
 * not a day"). A `isRealDay` test here would be that rule written a second
 * time, agreeing today and free to stop agreeing.
 */
export const nextAfter = (rule: Repeat, date: string): string => {
  const day = dayOf(date)
  switch (rule.every) {
    case "day":
      return shiftDay(day, 1)
    case "week":
      // Strictly after — `every week on monday` completed ON a Monday is the
      // NEXT Monday and not the same one. That rule is ./calendar.ts's, beside
      // the count it is arithmetic over and shared with the `!` widget's "next
      // friday", so the one subtle half of it has one answer.
      //
      // `null` is text that names no day, and it comes back as the day it was
      // given — the delegation the other three arms make by construction.
      return comingWeekday(day, rule.weekday) ?? day
    case "month":
      return shiftDayByMonth(day, 1)
    case "year":
      // Twelve MONTHS rather than a year added to the year, so the 29th of
      // February lands on the 28th by ./calendar.ts's own clamp instead of
      // minting a day that is not one.
      return shiftDayByMonth(day, 12)
  }
}

/**
 * The next occurrence of the rule this TEXT names, or `undefined` when the
 * text is not a rule — the two halves above in one call, for the callers that
 * hold a record's field rather than a parsed rule.
 *
 * Every one of them is in that position: the planner reads `node.repeat`, and
 * so does anything that wants to say what comes next. Composing the two
 * themselves is what lets a caller get the order wrong or forget the
 * `undefined`, which is ./calendar.ts's own argument for `monthOfDay`.
 */
export const nextOccurrence = (repeat: string, date: string): string | undefined => {
  const rule = parseRepeat(repeat)
  return rule === undefined ? undefined : nextAfter(rule, date)
}
