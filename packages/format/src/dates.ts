/**
 * The set, read by day.
 *
 * A node's dates are the whole of the journal. There is no stored year →
 * month hierarchy, no `Daily.jsonl`, no filename anything is special about
 * (docs/format.md; rewrite decision 11): a day is a QUESTION asked of every
 * node in every outline, and the answer is computed here, at view time, from
 * the same records the validator approved.
 *
 * TWO fields put a node on a day, and that is the 2026-08-11 decision: `date`,
 * which is what the node is scheduled for, and a dated `done` —
 * `{"done":"2026-08-11T15:40:03-04:00"}` is a node someone finished at that
 * instant (docs/format.md). A journal that showed what was scheduled but not
 * what was finished would be missing the half of the day that actually
 * happened. So both are read, one node can be on two days, and which of its
 * dates put it on a given day travels with it ({@link Occasion}) rather than
 * being guessed at by whoever draws the row.
 *
 * A dated `doing` or `todo` is read by NEITHER of the questions below. The
 * format allows a date on any of the three marks; a journal is narrower than
 * the format on purpose, and {@link datesOf} is where that line is drawn and
 * argued.
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
 * question asked of every node, and a day with neither is still inert.
 *
 * Dates are TEXT here, as they are everywhere else in this package: the format
 * validates them as ISO and stores them verbatim, so a day is a prefix and a
 * month is a shorter one. Nothing is parsed into an instant — a date-only
 * `2026-08-10` put through one comes back a datetime, and a calendar has no
 * business being the first place in the codebase that risks it.
 */

import { Order } from "effect"

import {
  type Derived,
  type Situated,
  situate,
  type Status,
  storedMarker,
} from "./derive.ts"
import { fileKind, isMirror, type LocatedRegular, type RegularNode } from "./node.ts"

/** How many characters of an ISO value name the day, and the month. A
 *  datetime is a day plus a time, so the day is the prefix they share. */
const DAY = 10
const MONTH = 7

/**
 * The calendar day a date value falls on.
 *
 * A datetime counts for its day: `2026-08-10T14:30` is the 10th, because a
 * person asking what is on the 10th means the meeting at half past two. The
 * value is validated ISO by the time it reaches here (parse.ts), so the day is
 * the first ten characters and no arithmetic is involved.
 */
export const dayOf = (value: string): string => value.slice(0, DAY)

/** The month a day belongs to, `YYYY-MM`. Same rule, three characters shorter. */
export const monthOf = (value: string): string => value.slice(0, MONTH)

/**
 * WHY a node is on a day: which of its two dates put it there.
 *
 * `date` is what the node is scheduled FOR; `done` is when the work was
 * finished. Two different sentences about the same day, and a reader looking at
 * a day page is entitled to know which one they are reading — so the answer is
 * carried rather than inferred from the fields, which is a thing a view could
 * only get wrong.
 *
 * TWO, and not one per mark. `doing` and `todo` may carry dates — the format
 * takes an ISO value on any of the three — and a day page reads NEITHER
 * (resolved 2026-08-11, human, from seeing it live). A journal is a record of
 * what happened and what is coming: finishing is an event, and being scheduled
 * is a plan, but "this was filed on Tuesday" and "this was picked up on
 * Tuesday" are facts about a task's paperwork. Read as days they buried the
 * 11th under every item captured that morning. The values stay legal and stay
 * on disk untouched; these views simply do not ask about them.
 */
export type Occasion = "date" | Extract<Status, "done">

/** A date a record carries, and the field that carried it — the pair, named
 *  once, because everything below passes them together and a row that had one
 *  without the other would be a date nobody could say the meaning of. */
export interface Occasioned {
  readonly occasion: Occasion
  /** The value, verbatim: for a node here because it was finished today, the
   *  completion instant, and not whatever it was scheduled for. */
  readonly date: string
}

/** One of a node's dates, with the node it belongs to. Lifted out of the
 *  record because every function below would otherwise re-narrow a field this
 *  one walk already decided — and because a node with two dates is two of
 *  these, which is exactly what "on both days" means.
 *
 *  Exported inside the package for the reason {@link byOutline} is: the forward
 *  reading (./agenda.ts) asks about several days at once, and it must ask them
 *  of this walk rather than of a second one that could disagree about what
 *  carries a date. It is not part of the package's public surface. */
export interface Dated extends Occasioned {
  readonly at: LocatedRegular
}

/**
 * The dates one record puts on a calendar, in PRECEDENCE order: what it is
 * scheduled for, then when it was finished.
 *
 * TWO FIELDS ARE READ — `date` and `done` — and this is the whole of the rule
 * (resolved 2026-08-11, human). A dated `doing` or `todo` is a legal record and
 * is passed over here: the format lets any mark carry an ISO value, and what a
 * JOURNAL is for is narrower than what the format allows. A day answers "what
 * is on, and what got done"; "this was filed on Tuesday" and "this was picked
 * up on Tuesday" are facts about a task rather than about the day, and read as
 * days they bury the day's real answer under everything captured that morning.
 * Nothing is written or rewritten to make that true — the values stay on disk,
 * and a reader that wants them can read them off the node.
 *
 * A mark holding `true` is on no day either. It says the state was reached and
 * declines to say when, which is a legal record and is the shape everything
 * written before `done` carried instants still has: there is nothing to put on
 * a calendar, and inventing a day for it would put years of finished work on
 * whatever day it was read.
 *
 * The mark is asked for through {@link storedMarker}, so a set the validator
 * has already condemned — two marks on one record — resolves the same one here
 * as it does in the checkbox: a record carrying `done` AND `todo` is on its
 * `done` day exactly when its checkbox is the one that says done.
 *
 * The order decides exactly one thing, and only for a node whose two dates land
 * on the SAME day: which occasion that day names ({@link datedOn}). `date`
 * first, because the checkbox has already said the work is finished and the day
 * it was scheduled for is not written anywhere else.
 *
 * Exported INSIDE the package, like {@link Dated} beside it and for the same
 * reason: `date:` in the query grammar (./filter.ts) asks the same question a
 * day page asks, and it must ask it of this walk rather than of a second one
 * that could disagree about which fields put a node on a day.
 */
export const datesOf = (node: RegularNode): ReadonlyArray<Occasioned> => {
  const dates: Array<Occasioned> = []
  if (node.date !== undefined) dates.push({ occasion: "date", date: node.date })
  if (storedMarker(node) === "done" && typeof node.done === "string") {
    dates.push({ occasion: "done", date: node.done })
  }
  return dates
}

/**
 * Every date of every node of the set, in file order, a node contributing one
 * for each date it carries.
 *
 * A MIRROR contributes none — it is a placement, and the format gives it no
 * field to carry a date or a mark — so a node on the 10th is on the 10th once,
 * however many places it is shown.
 *
 * The ARCHIVE is not excluded, and that is a decision rather than an omission
 * (resolved 2026-08-11, human). Blockedness exempts archived work at both ends
 * because nothing can be waiting on something that is over (./derive.ts) — a
 * journal asks a different question. It asks what happened, and archiving is
 * what people do with work AFTER they finish it, so a day that dropped the
 * archived half would be a record of the day with its ending torn out. The
 * node is still under `Archive.jsonl` when the day draws it, and the day view
 * groups by file, so the reader is told where it lives by the same heading
 * that tells them about every other row.
 */
const datedNodes = (derived: Derived): ReadonlyArray<Dated> =>
  derived.nodes.flatMap((located) =>
    isMirror(located.node) ? [] : datesOf(located.node).map((dated) => ({
      at: located as LocatedRegular,
      ...dated,
    }))
  )

/**
 * The same dates, bucketed by the day each falls on — ONE walk over the set.
 *
 * Which is what it is for: a reading that asks about one day can afford to walk
 * and filter, and a reading that asks about NINE — the agenda's today and the
 * days ahead of it (./agenda.ts) — cannot, because that is nine full passes
 * over a directory this app means to serve thousands of nodes from. Asked once
 * here, every one of those days is a lookup.
 *
 * A bucket keeps the set's own order, and {@link datesOf}'s precedence within
 * one record — which is what {@link groupedOn} then reads to decide which of a
 * node's two dates names the row.
 */
export const datedByDay = (
  derived: Derived,
): ReadonlyMap<string, ReadonlyArray<Dated>> => {
  const days = new Map<string, Array<Dated>>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    const bucket = days.get(day)
    if (bucket === undefined) days.set(day, [dated])
    else bucket.push(dated)
  }
  return days
}

/**
 * The days of `month` (`YYYY-MM`) that have at least one node on them.
 *
 * A SET, not counts: the calendar draws a dot, and a number nothing prints is
 * a fact with no reader. Days outside the month are left out, so a caller that
 * asks about a month with nothing in it gets an empty answer rather than a
 * grid it has to filter for itself.
 */
export const datedDays = (derived: Derived, month: string): ReadonlySet<string> => {
  const days = new Set<string>()
  for (const dated of datedNodes(derived)) {
    const day = dayOf(dated.date)
    if (monthOf(day) === month) days.add(day)
  }
  return days
}

/**
 * One node on a day: everything a zoomed page knows about it — the same {@link
 * Situated} that page is built from, because a day collects nodes from all
 * over the set and a title torn out of its outline says nothing — plus which
 * of its dates put it here.
 */
export interface DayEntry extends Situated, Occasioned {}

/** The nodes of one outline on the same day.
 *
 *  The day view groups by file because a `parent` never crosses one: two nodes
 *  in two outlines have no common ancestry to draw them under, and the file is
 *  the only heading that is true. */
export interface DayGroup {
  readonly file: string
  readonly nodes: ReadonlyArray<DayEntry>
}

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
  groupedOn(derived, datedByDay(derived).get(day) ?? [])

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
 *  document that is quietly nobody's note. Checking the range here would be
 *  this package's first piece of calendar arithmetic, bought for a case that
 *  cannot reach a screen. */
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
 * folder is not consulted because the file is what carries the name.
 *
 * WHICH files are documents is {@link fileKind}'s and stays there — the
 * extension is cut off by finding it rather than by spelling it a second time,
 * so a package that ever admitted another one does not leave this reading a
 * name it has taken the wrong number of characters off.
 */
export const noteDateOf = (file: string): string | null => {
  if (fileKind(file) !== "document") return null
  const name = file.slice(file.lastIndexOf("/") + 1)
  const stem = name.slice(0, name.lastIndexOf("."))
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
 * have and it is the one the sidebar already lists them in.
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
  documents.filter((file) => noteDateOf(file) === day).sort(Order.String)

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
 *  where the naming rule lives. */
export const isDay = (value: string): boolean => ISO_DAY.test(value)

/**
 * Where `day`'s note would go, following the vault's own convention — the path
 * a creation affordance mints when a bare day is pressed.
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
      (date === example.date && file < example.file)
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
