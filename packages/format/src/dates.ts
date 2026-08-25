/**
 * The set, read by day.
 *
 * A node's dates are the whole of the journal. There is no stored year →
 * month hierarchy, no `Daily.olai`, no filename anything is special about
 * (docs/format.md; rewrite decision 11): a day is a QUESTION asked of every
 * node in every LIVE outline, and this is where the two forms of it are
 * answered.
 *
 * WHAT PUTS A NODE ON A DAY is one module down (./occasion.ts): `date`, which
 * is what the node is scheduled for, and a dated `done`, which is when someone
 * finished it — two fields, so one node can be on two days, and which of its
 * dates put it on a given day travels with it (`Occasion`) rather than being
 * guessed at by whoever draws the row. What was put AWAY is on no day at all
 * (ruled 2026-08-17), and a mirror is on none either. All three of those are
 * argued at the fold that files them, because the fold is the one walk there is.
 *
 * THE ANSWERS ARE A LOOKUP, since `perf-dates-index`. Both questions below were
 * a pass over every record of every outline, and `./agenda.ts` above them was a
 * third — computed at view time, stored nowhere, and (since `vault-in-browser`'s
 * PR 4) run on the SERVER per subscriber per published revision, which is where
 * a walk per call stopped being affordable. The derivation carries the journal
 * as an index now ({@link Derived.byDay}), maintained by the patcher at what an
 * edit touched, and what changed here is only WHERE the days come from: the same
 * dates, the same order, the same exclusions, read instead of walked.
 *
 * Two questions, because there are two surfaces asking:
 *
 *   - {@link datedDays} — which days of one month have anything on them, which
 *     is what puts a dot under a number in the calendar;
 *   - {@link datedOn} — everything on one day, grouped by the outline it lives
 *     in and carrying the ancestry that says what it is ABOUT, which is the
 *     day view.
 *
 * They are one module because they are one reading of the set, and a calendar
 * whose dots disagreed with the day you opened would be worse than no calendar.
 * The FORWARD reading — what is owed rather than what is on — is ./agenda.ts,
 * which is built out of these: its Today section IS {@link datedOn}'s answer,
 * and every section of it is grouped by {@link byOutline}, so an agenda cannot
 * disagree with the day page a reader clicks through to.
 *
 * A THIRD reading joined them, and it is the one exception to the sentence
 * above about filenames: a document whose basename is exactly an ISO date IS
 * that day's note ({@link noteDateOf}). It is here, beside the other two, for
 * precisely the reason they are beside each other — the calendar's second
 * marker and the day page's note are one answer, and two spellings of "which
 * documents are this day's" would be two chances to disagree about a day
 * somebody is looking at. The doctrine is amended rather than abandoned: the
 * note JOINS the query's answer and never replaces it, so a day is still a
 * question asked of every live node, and a day with neither is still inert.
 *
 * Dates are TEXT here, as they are everywhere else in this package: the format
 * validates them as ISO and stores them verbatim, so a day is a prefix and a
 * month is a shorter one (./occasion.ts's `dayOf` and `monthOf`, which is where
 * the slicing lives). Nothing is parsed into an instant — a date-only
 * `2026-08-10` put through one comes back a datetime, and a calendar has no
 * business being the first place in the codebase that risks it.
 */

import { Order, Schema } from "effect"

import { dayAt, type Derived, Situated, situate } from "./derive.ts"
import { fileKind, stemOf } from "./kinds.ts"
import type { LocatedRegular } from "./node.ts"
import { type Dated, monthOf, Occasioned } from "./occasion.ts"
import { byPath } from "./paths.ts"

/**
 * Which days of `month` (`YYYY-MM`) have at least one node on them, in day
 * order.
 *
 * A WALK OF THE MONTH'S OWN KEYS, and nothing else: {@link Derived.byDay} holds
 * its days in order, so this takes what is inside the month and stops at the
 * first day past it. What it costs is the days the month HAS, where the walk it
 * replaces cost the directory — every record of every outline, per month a
 * reader paged to, per subscriber, per published revision (`perf-dates-index`).
 *
 * IT JUMPS INTO THE MONTH rather than stepping to it. Getting to the month was
 * the half that index did not fix: the keys of a map can only be walked from the
 * front, so paging to March cost every day of every year before it, one
 * `continue` each (`perf-agenda-history-walk`). {@link Derived.days} is those
 * same keys as an array and {@link dayAt} is a binary search over it — asked
 * with the MONTH, which is a shorter prefix than a day and therefore lands on
 * the first day the month can hold, since a day of that month extends it and
 * every earlier day is less than it in the code-point order these are kept in.
 *
 * DAYS, not counts: the calendar draws a dot, and a number nothing prints is a
 * fact with no reader. Days outside the month are left out, so a caller that
 * asks about a month with nothing in it gets an empty answer rather than a grid
 * it has to filter for itself.
 *
 * IN ORDER, which is the index's promise spent rather than a sort done here —
 * and what {@link datedAnswer} rests its equality on, one shape down.
 */
export const datedDays = (
  derived: Derived,
  month: string,
): ReadonlyArray<string> => {
  const days: Array<string> = []
  for (let at = dayAt(derived.days, month); at < derived.days.length; at++) {
    const day = derived.days[at] as string
    if (monthOf(day) > month) break
    days.push(day)
  }
  return days
}

/**
 * What a reader ASKS {@link datedDays} — one month, the one on screen.
 *
 * A shape on the floor rather than a string on a wire, and for the reason
 * `./searching.ts` gives about every other question this format is asked: since
 * `vault-in-browser`'s PR 4 the calendar's dots are computed on the server and
 * drawn in a browser, so the question crosses a wire, and a vocabulary spelled
 * in the wire spec would be a second spelling of this one free to drift from it.
 * `@olai/ops` produces the answer, `@olai/surface` carries it, the sidebar
 * draws it, and none of the three has to agree with the others by memory.
 */
export const DatedRequest = Schema.Struct({
  /** `YYYY-MM` — the month the grid is laid out for. A month with nothing in
   *  it is a legal question with an empty answer, which is what lets a reader
   *  page back through empty years without the door refusing. */
  month: Schema.String,
})
export type DatedRequest = typeof DatedRequest.Type

/**
 * Which days of that month have something on them.
 *
 * IN DAY ORDER, and the order is what makes the equality below mean anything.
 * The answer is re-read on every published revision and sent only when it
 * CHANGED (`@olai/server`'s `runtime.ts`), so "changed" has to mean "a
 * different set of days" rather than "the days were reached in a different
 * order" — a moved record must not light a dot. {@link Derived.byDay} promises
 * that order in the index itself, which is what let the sort that used to stand
 * here go: the days come out of it already in the only order this answer has.
 *
 * A LIST and not counts, for {@link datedDays}' own reason: the calendar draws
 * a dot, and a number nothing prints is a fact with no reader.
 */
export const DatedAnswer = Schema.Struct({
  days: Schema.Array(Schema.String),
})
export type DatedAnswer = typeof DatedAnswer.Type

/** When two answers name the same days, so the subscription carrying them can
 *  stay quiet — `./agenda.ts`'s `sameOwed` one reading over, and derived from
 *  the schema for the same reason. It compares the list IN ORDER, which
 *  {@link Derived.byDay}'s key order is what guarantees. */
export const sameDated: (a: DatedAnswer, b: DatedAnswer) => boolean = Schema
  .toEquivalence(DatedAnswer)

/**
 * The one way to build a {@link DatedAnswer} — {@link datedDays} asked of a
 * month.
 *
 * It is a re-wrap now and it keeps its place, which is worth saying rather than
 * leaving as an oversight. It used to carry the sort the wire's equality rests
 * on ({@link sameDated} compares the list in order); the order moved DOWN to
 * {@link Derived.byDay}, where three readings spend it instead of one. What is
 * left is the constructor beside the schema — the shape this package keeps for
 * every value that TRAVELS — so a second caller minting the struct by hand
 * cannot be the one that forgets where its order comes from.
 */
export const datedAnswer = (derived: Derived, month: string): DatedAnswer => ({
  days: datedDays(derived, month),
})

/**
 * One node on a day: everything a zoomed page knows about it — the same {@link
 * Situated} that page is built from, because a day collects nodes from all
 * over the set and a title torn out of its outline says nothing — plus which
 * of its dates put it here.
 */
export const DayEntry = Schema.Struct({ ...Situated.fields, ...Occasioned.fields })
export type DayEntry = typeof DayEntry.Type

/** The nodes of one outline on the same day.
 *
 *  The day view groups by file because a `parent` never crosses one: two nodes
 *  in two outlines have no common ancestry to draw them under, and the file is
 *  the only heading that is true.
 *
 *  A SCHEMA since `vault-in-browser`'s PR 10 — the day page and the agenda are
 *  readings the server computes and the wire carries, so what the walk produces
 *  and what the encoder reads are one declaration. */
export const DayGroup = Schema.Struct({
  file: Schema.String,
  nodes: Schema.Array(DayEntry),
})
export type DayGroup = typeof DayGroup.Type

/**
 * Everything on `day`, grouped by outline.
 *
 * Groups come in path order and a group's nodes in time order — a bare date
 * before any datetime on the same day, because an unspecified time is the day
 * itself and sorts as the earliest thing in it, which plain string comparison
 * on the stored value already gives. Ties break on the line, so the order is
 * the file's own and is the same on every render.
 *
 * ONE ROW PER NODE. A node scheduled for a day and finished on it carries two
 * dates that are the same day, and it is one thing that happened: the first in
 * {@link datesOf}'s precedence wins the row and names the occasion. Two rows
 * for one node would be the day claiming there were two.
 *
 * An empty array is a real answer: a day with nothing on it is a page that
 * says so, not a page that is missing.
 */
export const datedOn = (derived: Derived, day: string): ReadonlyArray<DayGroup> =>
  groupedOn(derived, derived.byDay.get(day) ?? [])

/**
 * The rows one day's records make: one per RECORD, situated, grouped.
 *
 * The half of {@link datedOn} that is about a day's own records rather than
 * about finding them, taken out for the reading that has already found
 * them — the agenda hands over the same day's records minus what is finished,
 * and a second spelling of "one row per record, situated" would be a second
 * chance to draw a node twice on one of the two pages.
 */
export const groupedOn = (
  derived: Derived,
  dated: ReadonlyArray<Dated>,
): ReadonlyArray<DayGroup> => {
  // Keyed by the RECORD, not by its id. Both dates of a node come off one
  // `located`, so this says "one row per record" without borrowing the
  // validator's uniqueness rule — and these walks deliberately run over sets it
  // has condemned (./derive.ts), where two files claiming one id are two nodes
  // a reader still has to be shown.
  const placed = new Set<LocatedRegular>()
  const entries: Array<DayEntry> = []
  for (const one of dated) {
    if (placed.has(one.at)) continue
    placed.add(one.at)
    entries.push(entryOf(derived, one))
  }
  return byOutline(entries)
}

/** The node, situated, wearing the date that put it here — the shape every
 *  reading of the set's dates hands its view, minted in one place. */
export const entryOf = (derived: Derived, dated: Dated): DayEntry => ({
  ...situate(derived, dated.at),
  occasion: dated.occasion,
  date: dated.date,
})

/**
 * Dated nodes, grouped by the outline they live in: groups in path order, each
 * group's nodes in time order.
 *
 * The grouping RULE, in one place, because two readings of the set draw the
 * same list — a day ({@link datedOn}) and the agenda's three sections
 * (./agenda.ts). The file is the only heading that is true for either of them,
 * for the same reason: a `parent` never crosses one, so two nodes in two
 * outlines have no common ancestry to draw them under. Two copies of it would
 * be two chances for one page to sort its outlines differently from the other.
 *
 * Not exported past this package: what a consumer gets is the two questions,
 * already answered.
 */
export const byOutline = (
  entries: ReadonlyArray<DayEntry>,
): ReadonlyArray<DayGroup> => {
  const byFile = new Map<string, Array<DayEntry>>()
  for (const entry of entries) {
    const group = byFile.get(entry.shows.file)
    if (group === undefined) byFile.set(entry.shows.file, [entry])
    else group.push(entry)
  }

  return [...byFile.entries()]
    .sort(([left], [right]) => Order.String(left, right))
    .map(([file, nodes]) => ({ file, nodes: nodes.sort(byTime) }))
}

/**
 * How many ROWS a list of day groups draws.
 *
 * Entries rather than groups, because a group is one outline's worth of them
 * and a reader counting what is on a day is counting the rows: "3 of 11" over a
 * filtered day, and "3 overdue" on the mark beside the agenda, are the same
 * number asked of the same list (./agenda.ts's `owedOf`, `@olai/web`'s filter
 * bar). Spelled here, beside {@link byOutline} that produces the shape, so the
 * two readings that count one cannot count it differently.
 */
export const datedIn = (groups: ReadonlyArray<DayGroup>): number =>
  groups.reduce((total, group) => total + group.nodes.length, 0)

/** Code-point order on the stored text, ties on the line — the same rule the
 *  error report sorts by (./errors.ts), and effect's own comparator rather
 *  than a hand-rolled one: `localeCompare` would put the same day in two
 *  orders on two machines. A bare date sorts before any datetime on the same
 *  day, which is what makes "the day itself" the earliest thing in it; oldest
 *  first is the same comparator read over more than one day (./agenda.ts). */
const byTime = (left: DayEntry, right: DayEntry): number =>
  left.date === right.date
    ? left.shows.line - right.shows.line
    : Order.String(left.date, right.date)

// ── the day's own note ─────────────────────────────────────────────────

/** A day, spelled out: four digits, two, two. The shape and nothing more —
 *  `2026-13-45.md` passes and names a day no month has, which is a day nothing
 *  can ever ask about (a calendar grid mints only real ones) and therefore a
 *  document that is quietly nobody's note.
 *
 *  ./calendar.ts's `isRealDay` is the OTHER question — the shape plus the
 *  month's own length — and it is a neighbour now rather than the arithmetic
 *  this file declined to be the first to do. This one is still the right rule
 *  HERE: a filename is matched by what it says, and a note named for a day no
 *  month has is inert rather than wrong. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The day a document is THE note for, or `null` for a document that is not one.
 *
 * CONVENTION OVER CONFIGURATION, and the convention is the whole rule: the
 * basename, with `.md` taken off, is exactly an ISO date. Nothing else is
 * consulted — not where the file sits, not what is inside it, not a setting.
 * So a vault keeping `Daily/2026/08/2026-08-12.md` matches by arithmetic
 * nobody had to be told, one keeping every note in the root matches the same
 * way, and `2026-08-10-recap.md` deliberately does not: it is a document ABOUT
 * a day rather than the day's own page, and the difference has to be
 * something a person can see in the filename.
 *
 * Read of a PATH, so the directories above the file are cut off first — a
 * folder named `2026-08-12` holding a `notes.md` is not a daily note, and the
 * folder is not consulted because the file is what carries the name. That is
 * {@link stemOf}'s rule and not this file's any more.
 *
 * WHICH files are documents is {@link fileKind}'s and stays there, and so now
 * is how much of the name the suffix costs. This used to cut at the last dot
 * itself, so that "a package that ever admitted another one does not leave this
 * reading a name it has taken the wrong number of characters off" — the right
 * worry, answered in the wrong place. The registry that knows which suffix is
 * on this file is the thing that knows how long it is, and it is one import
 * away.
 */
export const noteDateOf = (file: string): string | null => {
  if (fileKind(file) !== "document") return null
  const stem = stemOf(file)
  return ISO_DAY.test(stem) ? stem : null
}

/**
 * The daily notes of `day`, in path order.
 *
 * TWO documents may claim one date — a vault mid-migration has
 * `Daily/2026-08-12.md` and `journal/2026-08-12.md` — and both are listed
 * rather than one being picked. There is no conflict rule to invent here: the
 * files are the reader's, both of them say they are the 12th, and a view that
 * chose between them would be hiding a file somebody wrote on the strength of
 * a tiebreak nobody asked for. Path order, because it is the only order these
 * have and it is the one the sidebar already lists them in — and PATH ORDER IS
 * `byPath` ({@link ./paths.ts}), which is what makes that sentence true rather
 * than nearly true: a code-point sort agrees with the sidebar for every pair of
 * paths except a file and a directory sharing a name, which is exactly the pair
 * a vault mid-migration writes (`2026-08-12.md` beside `2026-08-12/`).
 *
 * The DOCUMENTS are passed in rather than read off a {@link Derived}, and that
 * is what the shape of the wire decides: a browser holds every document's PATH
 * and only the bodies of what is on screen (`snapshot-scale`), so the paths are
 * what both surfaces have in hand at the moment this question is asked.
 */
export const dailyNotesOn = (
  documents: ReadonlyArray<string>,
  day: string,
): ReadonlyArray<string> =>
  documents.filter((file) => noteDateOf(file) === day).sort(byPath)

/**
 * The days of `month` (`YYYY-MM`) that a note is written for — the calendar's
 * second marker, and the same shape {@link datedDays} answers in for the first.
 *
 * Two sets rather than one union, because the two marks say different things
 * and a reader has to tell a day that HOLDS WRITING from a day that has work
 * on it at a glance. A day in both is in both.
 */
export const dailyNoteDays = (
  documents: ReadonlyArray<string>,
  month: string,
): ReadonlySet<string> => {
  const days = new Set<string>()
  for (const file of documents) {
    const day = noteDateOf(file)
    if (day !== null && monthOf(day) === month) days.add(day)
  }
  return days
}

/** Whether a string is a bare ISO day — the shape a daily note's stem has, and
 *  the shape a request to MINT one must arrive in. The same rule
 *  {@link noteDateOf} reads off a filename, exported for the writer's side of
 *  it: a minted note is named for its day, so what may name one is decided
 *  where the naming rule lives.
 *
 *  SHAPE ONLY, which is the difference from ./calendar.ts's `isRealDay` beside
 *  it on the package surface: this one asks what a FILENAME says, that one asks
 *  whether a calendar holds the day. */
export const isDay = (value: string): boolean => ISO_DAY.test(value)

/**
 * Where `day`'s note would go, following the vault's own convention — the path
 * a creation affordance mints when + day note is pressed.
 *
 * CONVENTION IS READ, NEVER CONFIGURED, which is {@link noteDateOf}'s rule
 * facing the other way: detection asks nothing but the filename, so minting may
 * ask nothing but the filenames already there. The NEWEST existing daily note
 * is the example the vault itself provides — the reader has been keeping notes
 * somewhere, and the most recent one is where the convention currently stands,
 * which matters for a vault mid-migration whose old notes live somewhere its
 * new ones do not.
 *
 * Its directory is carried over with the DATE-SHAPED segments re-spelled for
 * the new day: a segment that is exactly the example's year, month, day,
 * `YYYY-MM` or `YYYY-MM-DD` becomes the same reading of the new date, and every
 * other segment travels verbatim. So `Daily/2026/08/2026-08-12.md` puts
 * September the 1st's note at `Daily/2026/09/2026-09-01.md`, `journal/2026-08/`
 * follows the same way, and a flat vault stays flat. WHOLE segments only: a
 * month is two digits, and two digits appear inside years — substring
 * replacement is how `2027` loses its middle to a February.
 *
 * A vault with no daily note yet has no convention to read, and the answer is
 * the simplest true one: the note goes at the root, named for its day. The
 * first note is what every later one reads its convention from.
 */
export const dailyNotePathFor = (
  documents: ReadonlyArray<string>,
  day: string,
): string => {
  const name = `${day}.md`

  /** The newest daily note, by its date — ties broken by path, so the answer
   *  is the same on every read. */
  let example: { readonly file: string; readonly date: string } | null = null
  for (const file of documents) {
    const date = noteDateOf(file)
    if (date === null) continue
    if (
      example === null || date > example.date ||
      (date === example.date && byPath(file, example.file) < 0)
    ) {
      example = { file, date }
    }
  }
  if (example === null) return name

  const from = {
    year: example.date.slice(0, 4),
    month: example.date.slice(5, 7),
    day: example.date.slice(8, 10),
  }
  const to = { year: day.slice(0, 4), month: day.slice(5, 7), day: day.slice(8, 10) }

  // Longest spelling first, so `2026-08` is one segment re-spelled rather than
  // a year the month check can no longer recognise.
  const respelled = (segment: string): string =>
    segment === `${from.year}-${from.month}-${from.day}`
      ? `${to.year}-${to.month}-${to.day}`
      : segment === `${from.year}-${from.month}`
      ? `${to.year}-${to.month}`
      : segment === from.year
      ? to.year
      : segment === from.month
      ? to.month
      : segment === from.day
      ? to.day
      : segment

  const directory = example.file.split("/").slice(0, -1).map(respelled)
  return [...directory, name].join("/")
}
