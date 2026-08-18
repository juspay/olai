/**
 * The set, read forward: what is OWED.
 *
 * A day page asks what is on a day; this asks what has not happened yet and
 * should have. It is the same kind of question and the same kind of answer —
 * derived at view time, over every node in every outline, stored nowhere — so
 * it is built out of ./dates.ts rather than beside it (docs/brainstorming/
 * agenda.md, ratified 2026-08-12).
 *
 * ## No new field: `date` and the mark, read together
 *
 * The format already keeps the two questions apart — `date` says WHEN, a mark
 * says whether it is work — and an agenda is what they answer together:
 *
 *   - `date` and NO mark is an OCCURRENCE: a birthday, an appointment, a note
 *     pinned to a day. It can never be overdue, because a day passing is not a
 *     failure of a bullet. That is the crown rule of the format read once more
 *     (docs/format.md's Status): an unmarked node is not an unfinished one.
 *   - `date` with `todo` or `doing` is DUE WORK — the only thing that can be
 *     late, because somebody said it was work and said when.
 *
 * A second `due` field beside `date` would have been two dates answering one
 * question, which is the disagreement the mirror shape exists to make
 * unrepresentable. So nothing here is stored and nothing here is written.
 *
 * ## Overdue is the next `blocked`
 *
 * {@link isOverdue} is spelled ONCE and read everywhere — the days above now on
 * the agenda's spine and the tone every date badge takes are one predicate, for the reason
 * blockedness is one predicate read at both ends of its arrow (./derive.ts): two
 * spellings would be two chances to disagree about what late work is. It is a
 * SECOND fact about a node and never a replacement for its mark, and `done`
 * extinguishes it by construction — a finished task is late at nothing.
 *
 * The one thing this reading needs that the set cannot give it is what day it
 * IS, so `today` is an argument at every entry point here. A clock in this
 * package would be a fact about the reader smuggled into a fact about the
 * directory — and a derivation whose answer changed with the machine it ran on.
 */

import { Order } from "effect"

import { daysBetween, MONTHS, WEEKDAYS, weekdayOf } from "./calendar.ts"

import {
  type Dated,
  datedByDay,
  datedIn,
  type DayGroup,
  dayOf,
  groupedOn,
  timeOf,
} from "./dates.ts"
import { type Derived, storedMarker } from "./derive.ts"
import { keepingDated } from "./filter.ts"
import type { RegularNode } from "./node.ts"

/**
 * Should this have happened by now?
 *
 * `overdue(n) ⇔ n carries todo or doing ∧ day(n.date) < today`, and the two
 * halves are both load-bearing. The MARK half is written as the two marks it
 * names rather than as `mark !== "done"`, which is the trap blockedness is
 * written against one file over: that spelling reads every plain dated bullet
 * as work somebody is late on, which is exactly what an occurrence is not.
 * `doing` is in (human, 2026-08-12: started-but-unfinished is the most honest
 * yes to the question this asks; the narrower todo-only reading was declined).
 *
 * The DAY half is plain string comparison over the first ten characters, here
 * as everywhere — dates are text, and a `2026-08-10` put through an instant
 * comes back a datetime. BOTH SIDES go through {@link dayOf}, including the one
 * the caller supplies: this is the predicate the whole feature reads, so it
 * answers about a day whatever shape of ISO value it is handed rather than
 * relying on every caller to have trimmed one first. An instant for `today`
 * used to make work due TODAY read as late — `"2026-08-12" < "2026-08-12T09:00"`
 * is true, a prefix being less than what extends it — which is the one wrong
 * answer this comparison can give.
 *
 * Asked of the node's OWN record, which is what makes a mirror's row answer
 * with its target's date and its target's mark: a placement carries neither.
 */
export const isOverdue = (node: RegularNode, today: string): boolean => {
  if (node.date === undefined) return false
  const mark = storedMarker(node)
  return (mark === "todo" || mark === "doing") && dayOf(node.date) < dayOf(today)
}

/** One day ahead, and what is on it. The date is a HEADING here rather than a
 *  page — the day's own page is where it is read in full, note and finished
 *  work and all — so it travels as the text it will be printed and linked as. */
export interface AgendaDay {
  readonly date: string
  readonly groups: ReadonlyArray<DayGroup>
}

/**
 * What is owed, as the three stretches of ONE LINE: what has gone, now, and
 * what is coming.
 *
 * Three fields and no sections, and the difference between those two words is
 * the whole of `agenda-spine` (ruled 2026-08-18). The page that reads this used
 * to draw a box per field, which gave a task seventy-three days out the same
 * claim on a reader as one due on Monday. It draws a SPINE now — one continuous
 * line of time with now marked on it — so these three are where a day sits
 * relative to that mark, and not three headings.
 *
 * Which is why what has SLIPPED arrives as days, exactly as what is coming
 * does. It used to arrive as one flat list grouped by outline, which is the
 * shape a box wants: a day is where a node goes on the line, so late work has
 * to bring the day it was owed on with it.
 */
export interface Agenda {
  /** The days that have gone and still owe something, oldest first. Every node
   *  on one of them is overdue, by construction ({@link behind}). */
  readonly overdue: ReadonlyArray<AgendaDay>
  /** What today's day page holds, minus finished work — GROUPS rather than a
   *  day, because the page already knows which day today is and draws now on
   *  the line whether or not anything is owed on it. */
  readonly today: ReadonlyArray<DayGroup>
  /** The next days that have anything. Days with nothing are absent. */
  readonly upcoming: ReadonlyArray<AgendaDay>
}

/**
 * How far ahead Upcoming looks: the next seven days that HAVE something, not
 * the next seven days.
 *
 * A count of populated days rather than a window of dates, and that is the
 * whole of the bound — a horizon in days would be date arithmetic, which this
 * package deliberately does not do (dates are text), and a horizon a reader
 * could configure would be a setting invented for a question nobody has asked
 * yet. What it costs is honest: a directory with something on every day shows a
 * week, and one with something once a month shows seven months. Both are "the
 * next few things", which is what an agenda is for.
 */
export const UPCOMING_DAYS = 7

/**
 * The agenda: one reading of the whole set, at `today`.
 *
 * The ARCHIVE is out of it, and not by a rule of this module's: what is owed is
 * read out of the same bucketed walk a day page is (./dates.ts), and that walk
 * leaves archived nodes out for every reading built on it (ruled 2026-08-17,
 * human — what was put away is drawn on the trash page and nowhere else). It is
 * inherited rather than restated for the reason every other date question here
 * is: two spellings of "which nodes have days" would be two chances for the
 * agenda and the day page it links to to disagree about the same node.
 *
 * So a task put away after somebody scheduled it stops being owed. That is the
 * ruling in one sentence — archiving is a reader saying they are done looking
 * at something, and a page that went on asking them for it would be arguing.
 */
export const agendaOf = (derived: Derived, today: string): Agenda => {
  // ONE walk over the set, for every day of the line: each of them is a
  // question about a day, and asking a dozen of them of a dozen walks is what
  // a bucketed reading exists to stop (./dates.ts).
  const days = datedByDay(derived)
  return {
    overdue: behind(derived, days, today),
    today: owedOn(derived, days, today),
    upcoming: aheadOf(derived, days, today),
  }
}

/** Nothing to show, said once: an empty agenda is a page that says so, offers
 *  nothing to press and draws no line at all, and "empty" is the conjunction of
 *  the three halves rather than something a view should re-derive. */
export const nothingDue = (agenda: Agenda): boolean =>
  agenda.overdue.length === 0 &&
  agenda.today.length === 0 &&
  agenda.upcoming.length === 0

/**
 * How much is owed, in the two numbers a mark outside the page is drawn from.
 *
 * UPCOMING IS NOT COUNTED, and that is the whole of the shape: this answers
 * "is anything wrong as of today", and a task due next Tuesday is not news on
 * a Monday — a count that included it could never fall to nothing, which is a
 * mark nobody would read twice.
 */
export interface Owed {
  /** Nodes in {@link Agenda.overdue}, across every outline it groups. */
  readonly overdue: number
  /** Nodes in {@link Agenda.today}, the same way — OCCURRENCES INCLUDED,
   *  because they are rows that section draws and this counts what the page
   *  shows. Which is why nothing that prints this number may call it *due*: a
   *  birthday is on today and is nobody's late work. */
  readonly today: number
}

/**
 * The counts, taken from an agenda that has already been read.
 *
 * It takes the ANSWER rather than the set, which is the point of it: a second
 * walk that counted late work its own way would be a second reading of one
 * directory, free to disagree with the page listing it — the same argument
 * {@link nothingDue} is spelled here for, one predicate up. So whatever marks
 * the agenda from outside it counts the very rows the page draws.
 *
 * NODES rather than groups: a group is one outline's worth of them, and "3"
 * on a mark means three things are late, not three files are.
 */
export const owedOf = (agenda: Agenda): Owed => ({
  overdue: datedInDays(agenda.overdue),
  today: datedIn(agenda.today),
})

/**
 * The same agenda narrowed to what a query selected — every day of the line,
 * and today between them.
 *
 * The agenda is a page like the others, so the filter over it is
 * {@link keepingDated} applied to each of the three rather than a rule of its
 * own: one definition of what a filtered day-group list is, wherever one is
 * drawn (docs/search.md's "which pages filter").
 *
 * A DAY THAT HAS NOTHING LEFT LEAVES THE LINE, which is this module's own
 * standing rule read once more: a day is listed exactly when there is something
 * owed on it ({@link aheadOf}, {@link behind}), and a dot over no rows would be
 * the page promising a day the query found nothing on. THE SILENCES BETWEEN
 * DAYS ARE RECOMPUTED rather than narrowed, and they are recomputed because
 * they are not data: how long a wait is, is a fact about the days still drawn
 * (`@olai/web`'s spine), so taking a day out shortens the two gaps either side
 * of it into one longer one with no help from here.
 *
 * Nothing is re-derived: this is the answer {@link agendaOf} already gave, with
 * rows taken out of it. So what the mark beside the page counts (`owedOf`, over
 * the UNFILTERED reading) cannot be changed by somebody typing in a box — the
 * filter is a question about the open page, and what is owed is a fact about
 * the directory.
 */
export const keepingOwed = (
  agenda: Agenda,
  matched: ReadonlySet<string>,
): Agenda => ({
  overdue: keepingDays(agenda.overdue, matched),
  today: keepingDated(agenda.today, matched),
  upcoming: keepingDays(agenda.upcoming, matched),
})

/** One half of the line, narrowed: every day's rows filtered, and a day left
 *  with none dropped. Dropped rather than kept empty because a day IS its
 *  reason for being on the line — and because the silence either side of it is
 *  drawn from the days that remain, so a day with nothing on it would leave the
 *  page claiming a wait that has nothing at either end of it. */
const keepingDays = (
  days: ReadonlyArray<AgendaDay>,
  matched: ReadonlySet<string>,
): ReadonlyArray<AgendaDay> =>
  days.flatMap((day) => {
    const groups = keepingDated(day.groups, matched)
    return groups.length === 0 ? [] : [{ ...day, groups }]
  })

/** How many ROWS an agenda draws, over the whole line — what a filter bar
 *  counts, where {@link owedOf} counts what is NEWS. Upcoming is in this one
 *  and out of that one for the same reason it is drawn on the page and absent
 *  from the mark: a reader counting the rows in front of them is counting every
 *  row in front of them. */
export const owedIn = (agenda: Agenda): number =>
  datedInDays(agenda.overdue) + datedIn(agenda.today) +
  datedInDays(agenda.upcoming)

/** How many rows a run of DAYS draws — {@link datedIn} over the two halves of
 *  the line that arrive as days, said once because both halves ask it and a
 *  second `reduce` would be a second chance to count a group instead of a row. */
const datedInDays = (days: ReadonlyArray<AgendaDay>): number =>
  days.reduce((total, day) => total + datedIn(day.groups), 0)

/** Every day the set has anything on, and what it has on it. */
type Days = ReadonlyMap<string, ReadonlyArray<Dated>>

/**
 * The days that have GONE and still owe something, oldest first.
 *
 * The mirror of {@link aheadOf}, and written beside it for that reason: the
 * spine puts every day on one line by its date, so what has slipped arrives as
 * days exactly as what is coming does.
 *
 * UNBOUNDED, where the far half stops at {@link UPCOMING_DAYS}: a horizon on
 * what is late would be a page quietly dropping the one answer no day page can
 * give. What bounds it in practice is the work — a directory owes as many late
 * days as somebody has let slip.
 *
 * A MIRROR contributes none, and that is the bucketed walk's rule rather than
 * one restated here — a mirror is a placement, and the format gives it no field
 * to carry a date or a mark, so a task that is late is late once however many
 * places it is shown.
 *
 * ONE ROW PER NODE falls out rather than being deduplicated: a record's two
 * dates are its `date` and a dated `done`, and a node whose mark is `done` is
 * not overdue — so a node here is here for its `date` and can be on no other
 * day of this half.
 */
const behind = (
  derived: Derived,
  days: Days,
  today: string,
): ReadonlyArray<AgendaDay> => {
  const gone: Array<AgendaDay> = []
  for (
    const date of [...days.keys()].filter((day) => day < dayOf(today)).sort(
      Order.String,
    )
  ) {
    const owed = (days.get(date) ?? []).filter((one) =>
      isOverdue(one.at.node, today)
    )
    if (owed.length > 0) gone.push({ date, groups: groupedOn(derived, owed) })
  }
  return gone
}

/**
 * What is OWED on one day: everything the day page would show, minus what is
 * finished.
 *
 * `done` never appears anywhere on this page — the agenda answers what is owed
 * and a day page answers what happened — so the filter is applied to every
 * section built out of a day's records. A node whose `done` is dated today is
 * on today's PAGE and not on today's agenda, which is the difference between
 * the two questions in one sentence.
 *
 * Filtered BEFORE the entries are situated, which is the cheap order: situating
 * is an ancestry walk and a rollup per node, and a day whose work is finished
 * would be paying both to have the answer thrown away.
 */
const owedOn = (
  derived: Derived,
  days: Days,
  day: string,
): ReadonlyArray<DayGroup> =>
  groupedOn(derived, (days.get(day) ?? []).filter((one) => unfinished(one.at.node)))

/** Anything that is not finished work — the one spelling of it in this module,
 *  because "what is left" is the question the whole page asks and two ways of
 *  answering it would be two chances to disagree. */
const unfinished = (node: RegularNode): boolean => storedMarker(node) !== "done"

/**
 * The days after `today` that have something owed on them, ascending, bounded
 * by {@link UPCOMING_DAYS}.
 *
 * "Days with nothing do not appear" is asked with the SAME filter that draws
 * the day — a day is listed exactly when `owedOn` has something for it — rather
 * than with a nomination rule that could quietly disagree with it and leave a
 * heading over an empty section.
 */
const aheadOf = (
  derived: Derived,
  days: Days,
  today: string,
): ReadonlyArray<AgendaDay> => {
  const ahead: Array<AgendaDay> = []
  for (
    const date of [...days.keys()].filter((day) => day > today).sort(Order.String)
  ) {
    if (ahead.length === UPCOMING_DAYS) break
    const groups = owedOn(derived, days, date)
    if (groups.length > 0) ahead.push({ date, groups })
  }
  return ahead
}

// ── the spine: where a day SITS, and how far away it feels ─────────────
//
// The half of `agenda-spine` (ruled 2026-08-18) that is arithmetic. The page
// draws one line of time with now marked on it, and everything it says about a
// day past the day itself is counted here rather than in a component: how many
// days away it is, what to call that distance, how faint the day has gone, and
// how much silence lies between it and the day before it.
//
// HERE and not in ./calendar.ts, which is where a day is COUNTED, because these
// are not questions about the calendar — they are questions about an agenda,
// asked from today, and `today` is an argument at every entry point of this
// module for the reason its header gives. What this asks of that one is a
// subtraction (`daysBetween`) and the two lists of names.
//
// And here rather than in the badge that prints the words, which is the
// standing rule this extends rather than breaks (`@olai/web`'s DateBadge.tsx:
// printed verbatim, because the format stores it verbatim). A pill that read
// "1 day late" would have been a component doing arithmetic on a date; a pill
// handed "1 day late" is still printing what it was given.
//
// THE RUNTIME SHIPS TWO OF THESE AND NEITHER IS ADOPTED, which is worth saying
// rather than leaving as an oversight. `Intl.RelativeTimeFormat` would give
// "in 6 days" and "yesterday"; `Intl.DateTimeFormat` would give "Mon, Aug 24".
// Both move with the MACHINE'S LOCALE, and this codebase already ruled the
// other way for the words beside a date (`@olai/web`'s `monthLabel`: these sit
// beside ISO dates somebody typed by hand, so they are words rather than
// something that moves with a setting). Neither can say the other half of what
// this module says at all — "2½ months", "1 day late", "two quiet weeks" are
// not relative times, they are this page's sentences. Adopting one for the
// third of the vocabulary it covers would be two spellings of the same ramp.

/** Which side of NOW a day sits on. Three, because the line has three
 *  stretches and a dot is drawn differently in each — and it is a fact about
 *  the DAY rather than a section it was filed under, which is the whole of what
 *  changed. */
export type Standing = "late" | "today" | "ahead"

/** Which palette token the line and a day's dot take at that distance —
 *  NAMES, never values, so all fifteen palettes follow (`@olai/web`'s
 *  theme/palettes.ts). The ramp is the flow of time: alarm above now, accent
 *  at it, then ink fading through muted to rule as the future recedes. */
export type Tone = "alarm" | "accent" | "ink" | "muted" | "rule"

/**
 * A day on the spine: where it sits, how far it is, and what to call that.
 *
 * TWO FIELDS ARE ABSENT TOGETHER or present together — the distance and the
 * words for it — and they are optional for one reason: this is total in both
 * its arguments, and text that names no calendar day can be COMPARED but not
 * COUNTED. Saying nothing is the only honest answer to "how far away"; the
 * shape is what stops the alternative, which is what this used to do — a `0`
 * standing for both "today" and "I could not count", read one line later as
 * "0 days ago" under a heading that had already said the day was late.
 *
 * The format's own parser makes that unreachable from a validated set: a date
 * is checked for CALENDAR REALITY and not merely for shape (./parse.ts —
 * `2026-02-30` is refused), so nothing on a page reaches here uncountable. The
 * optionality is therefore a statement about this function rather than a state
 * a view has to draw around, and a view that draws around it anyway costs one
 * `Show`.
 */
export interface Felt {
  readonly standing: Standing
  /** Whole calendar days from today — negative for a day that has gone. */
  readonly days: number | undefined
  /** The day itself, in words: `Mon, Aug 24`. Always answerable: text that
   *  names no day is printed back as it was written. */
  readonly calendar: string
  /** How far away it FEELS: `Today`, `Tomorrow`, `Yesterday`, `in 6 days`,
   *  `in 3 weeks`, `in 2½ months`, `7 years ago`. */
  readonly distance: string | undefined
  /** How far the day has RECEDED, `1` near at hand down to {@link FURTHEST} —
   *  what a row's whole entry is drawn at. */
  readonly fade: number
  /** The ink the line and this day's dot take here. */
  readonly tone: Tone
}

/** How faint the far future gets. A floor rather than a fade to nothing: a row
 *  a reader cannot read is a row the page may as well not have drawn. */
const FURTHEST = 0.5

/** Within a week is NEAR — full ink, no fade. A week is the horizon a person
 *  actually plans against, and everything closer than one is equally present. */
const NEAR = 7

/** Past eight weeks the line is down to its faintest ink. Eight rather than a
 *  round number of days because the label is already counting in weeks by
 *  then, and a boundary a reader can feel is a boundary in the unit they are
 *  reading. */
const FAR = 56

/** How fast the fade rolls off, per natural log of the distance past
 *  {@link NEAR}. LOG-ISH for the reason the silences are: the difference
 *  between six days and thirteen is most of what a reader cares about, and the
 *  difference between two years and three is none of it. */
const ROLLOFF = 5

/**
 * A day, felt from today.
 *
 * Total in both arguments: a value naming no real calendar day still gets a
 * standing (plain string comparison, which is what the rest of this module
 * reads dates with) and simply says nothing about distance — no guess, and no
 * throw on a page whose whole content is derived.
 */
export const feltOn = (date: string, today: string): Felt => {
  const day = dayOf(date)
  const now = dayOf(today)
  const standing: Standing = day < now ? "late" : day > now ? "ahead" : "today"
  const days = daysBetween(now, day) ?? undefined
  return {
    standing,
    days,
    calendar: calendarOf(day),
    distance: days === undefined ? undefined : distanceOf(standing, days),
    // An uncountable day is drawn at the near end of the ramp: the fade and the
    // ink are how far away a day LOOKS, and looking as though it were at hand
    // is the reading that hides nothing.
    fade: days === undefined ? 1 : fadeOf(standing, days),
    tone: days === undefined ? toneOf(standing, 0) : toneOf(standing, days),
  }
}

/**
 * What a row's date pill still has to say — or NOTHING, which is the answer
 * for most rows on the page.
 *
 * The chrome cut, as a function. A day on the spine says its own date once, in
 * its heading, so a pill under that heading repeating it is the fourth copy of
 * a fact nobody asked twice for. Two things the heading cannot say survive:
 *
 *   - HOW LATE a task is. The heading says which day has gone; "3 days late" is
 *     the sentence about the work, and it is where the alarm tone is already
 *     spent (`isOverdue`, one predicate read everywhere).
 *   - WHAT TIME a datetime names. `14:00` is a fact about the appointment and
 *     not about the day, and it is the one thing a day heading is not.
 *
 * It takes the DAY'S OWN reading rather than a second date to count from, and
 * that is two things at once. The subtraction happens once per day instead of
 * once per row — every row of a day is late by exactly that day's distance, by
 * construction ({@link behind} files a node under the day its `date` names) —
 * and the call site stops being two interchangeable ISO strings in a row, which
 * is a swap no type could have caught.
 *
 * `overdue` is passed rather than re-derived: the row has already asked
 * {@link isOverdue} of the node, and asking it again of a date alone would be a
 * second, weaker spelling of the predicate — a date in the past is not late
 * work unless somebody marked it work.
 */
export const owedFact = (
  date: string,
  overdue: boolean,
  felt: Felt,
): string | undefined => {
  if (!overdue) return timeOf(date)
  return felt.days === undefined ? undefined : lateness(felt.days)
}

/** How late something is, said the way a pill says it: `1 day late`,
 *  `3 weeks late`. Takes the (negative) distance {@link Felt} counts. */
const lateness = (days: number): string => `${said(spanOf(days))} late`

/**
 * The silence between two consecutive days on the line.
 *
 * GAPS ARE CONTENT, which is the ruling this exists for: the stretch between
 * two listed days is a thing the page says rather than margin it happens to
 * have. A wait long enough to notice gets called what it is, and the room it
 * takes grows with it.
 */
export interface Quiet {
  /** Whole days waited. */
  readonly days: number
  /** What the silence is CALLED — `two quiet weeks`, `6½ quiet years` — or
   *  nothing at all where the wait is too short to be worth a word. */
  readonly label: string | undefined
  /** How much room it takes, in rem, between {@link QUIET_LEAST} and
   *  {@link QUIET_MOST}. */
  readonly space: number
}

/** The least room a gap ever takes, and the most. The ceiling is the half of
 *  "log-ish, never linear" that a logarithm alone does not buy: seven years of
 *  silence has to read as longer than two days without costing a screen. */
const QUIET_LEAST = 1
const QUIET_MOST = 5

/** The silence before a day, counted from the one before it. */
export const quietBetween = (from: string, to: string): Quiet => {
  const days = Math.max(daysBetween(dayOf(from), dayOf(to)) ?? 0, 0)
  return { days, label: quietLabel(days), space: spaceFor(days) }
}

/** What a wait is called, or nothing. Nothing under a fortnight, because "one
 *  quiet week" is not a silence anybody notices and a label per gap is the
 *  chrome this page was redrawn to be rid of — a gap that says nothing is
 *  still saying it, in the whitespace {@link spaceFor} gives it. */
const quietLabel = (days: number): string | undefined => {
  const span = quietSpan(days)
  return span === undefined ? undefined : `${spelled(span)} quiet ${span.unit}s`
}

/** How much room a wait takes. Log base two, so every doubling of the wait
 *  costs the same fixed step, clamped at both ends. */
const spaceFor = (days: number): number =>
  Math.min(
    Math.max(0.75 + Math.log2(Math.max(days, 1)) * 0.6, QUIET_LEAST),
    QUIET_MOST,
  )

// ── the words ──────────────────────────────────────────────────────────

/** A magnitude, in the largest unit that still reads: how many, of what, and
 *  whether it is one of them (which is the whole of English pluralisation
 *  here). `count` is text because half a month is `2½`. */
interface Span {
  readonly count: string
  readonly unit: "day" | "week" | "month" | "year"
  readonly one: boolean
}

/** The average lengths a month and a year have when nobody says which one.
 *  Only ever divided BY — a distance is already an exact count of days
 *  ({@link daysBetween}), and these turn that count into the unit a person
 *  would have used. */
const MONTH_DAYS = 30.436875
const YEAR_DAYS = 365.2425

/**
 * How far, in the unit a person would say it in: days under a fortnight, then
 * weeks, then months past two of them, then years — which is the phrasing the
 * design ruled ("under two weeks in days, then weeks, past ~2 months in
 * months-and-halves") with one band added past it, because a directory whose
 * fixtures are dated in 2019 will otherwise be told something is 2470 days
 * away.
 */
const spanOf = (days: number): Span => {
  const away = Math.abs(days)
  if (away < 14) return counted(away, "day")
  if (away < 60) return counted(Math.round(away / 7), "week")
  if (away < 550) return halved(away / MONTH_DAYS, "month")
  return halved(away / YEAR_DAYS, "year")
}

const counted = (count: number, unit: Span["unit"]): Span => ({
  count: String(count),
  unit,
  one: count === 1,
})

/** The same, rounded to the nearest HALF and printed as one — `2½ months`.
 *  Halves because they are the resolution a person actually feels at this
 *  distance: "in two and a bit months" is what "in 73 days" means. */
const halved = (value: number, unit: Span["unit"]): Span => {
  const rounded = Math.round(value * 2) / 2
  const whole = Math.floor(rounded)
  return {
    count: rounded > whole ? `${whole}½` : String(whole),
    unit,
    one: rounded === 1,
  }
}

/** A span, said: `1 day`, `6 days`, `2½ months`. */
const said = (span: Span): string =>
  `${span.count} ${span.unit}${span.one ? "" : "s"}`

/** How far away a day feels, in its own voice.
 *
 *  The three days either side of now are NAMED rather than counted, because
 *  that is what a person calls them — "in 1 day" is a sentence nobody says. */
const distanceOf = (standing: Standing, days: number): string => {
  if (standing === "today") return "Today"
  if (days === 1) return "Tomorrow"
  if (days === -1) return "Yesterday"
  const span = spanOf(days)
  return days > 0 ? `in ${said(span)}` : `${said(span)} ago`
}

/** The day itself, in words: `Mon, Aug 24`. Three letters of each name — the
 *  most a day heading can spend before it starts reading as a date rather than
 *  as a place on a line. */
const calendarOf = (day: string): string => {
  const weekday = weekdayOf(day)
  const month = MONTHS[Number(day.slice(5, 7)) - 1]
  if (weekday === null || month === undefined) return day
  return `${WEEKDAYS[weekday]!.slice(0, 3)}, ${month.slice(0, 3)} ${
    Number(day.slice(8, 10))
  }`
    .replace(/^./, (first) => first.toUpperCase())
}

/** A wait's magnitude, or nothing under a fortnight. Its own banding rather
 *  than {@link spanOf}'s, and the difference is exactly one: a THIRTEEN-day
 *  silence is two quiet weeks, where a day thirteen days out is "in 13 days".
 *  A distance is counted from now and a wait is counted between two things, and
 *  the second rounds sooner because nobody is planning against it. */
const quietSpan = (days: number): Span | undefined => {
  const weeks = Math.round(days / 7)
  if (weeks < 2) return undefined
  if (days < 60) return counted(weeks, "week")
  if (days < 550) return halved(days / MONTH_DAYS, "month")
  return halved(days / YEAR_DAYS, "year")
}

/** The numbers a quiet label writes as WORDS. A silence is prose beside the
 *  line — "two quiet weeks" — where a distance is a measurement, so the small
 *  counts are spelled and anything past them (or carrying a half) stays a
 *  numeral rather than becoming a paragraph. */
const NUMBERS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const

const spelled = (span: Span): string => NUMBERS[Number(span.count)] ?? span.count

/** How faint a day is drawn. Full ink out to a week, then a logarithmic
 *  roll-off to {@link FURTHEST} — so an item seventy-three days out no longer
 *  shouts as loudly as one due on Monday, which is the complaint the whole
 *  redraw answers. Rounded to two places: a fade is an inline style, and
 *  0.7834710 in the DOM is noise a reader of the markup has to skip. */
const fadeOf = (standing: Standing, days: number): number => {
  if (standing !== "ahead" || days <= NEAR) return 1
  const faded = 1 - Math.log(days / NEAR) / ROLLOFF
  return Math.round(Math.max(faded, FURTHEST) * 100) / 100
}

/** The ink of the line and of the day's dot: alarm above now, accent at it,
 *  then the future receding through ink and muted to rule. */
const toneOf = (standing: Standing, days: number): Tone => {
  if (standing === "late") return "alarm"
  if (standing === "today") return "accent"
  return days <= NEAR ? "ink" : days <= FAR ? "muted" : "rule"
}
