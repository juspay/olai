/**
 * `journal.agenda` — THE JOURNAL'S TWO READINGS, OFFERED TO OTHER PLUGINS.
 *
 * The day page and the agenda page draw what is dated on a day and what is owed
 * as of it. Until this door, a plugin that wanted the same answer had two ways
 * to get it and both were wrong: derive it a second time (`@olai/format` is
 * there, so two spellings of *what is late* would be two chances to disagree
 * with the page a person is looking at), or reach the journal's sibling surface,
 * which is a wire exposed to the browser and to nobody else.
 *
 * So the reading is a SERVICE the journal row stands behind. It is offered with
 * `Offers.own`, so the key is stamped `journal.agenda` from the offering fiber's
 * name and no plugin can spell another's namespace; a consumer names
 * `serviceTag<JournalAgenda>("journal.agenda")` in its `needs`, waits while the
 * journal row is off, and comes back when it returns — which is Cordis's own
 * rule rather than anything written here.
 *
 * ## THE READING COMES IN, which is `Search`'s argument one plugin over
 *
 * A door that read the vault for itself would answer about a revision of its own
 * choosing, and the caller would have no way to say which one it meant. So the
 * caller hands over the reading the answer is to be about — the value its own
 * {@link @olai/plugin-api}'s `Vault.revision` handed it, or `Ops.reading` — and
 * gets an answer about that snapshot and no other.
 *
 * ## THE ASK IS OPAQUE AND THE ANSWER IS NOT, and the asymmetry is the boundary
 *
 * `at` is `unknown` because the consumer this exists for is a plugin the VAULT
 * defines, which may import `@olai/plugin-api`, `effect` and `solid-js` and
 * nothing else (`docs/dynamic-plugins.md`). Such a plugin cannot name a
 * `Reading`; what it can do is pass one through, which is exactly what it gets
 * from the revision door. It is narrowed once, here, at the journal's own edge.
 *
 * The ANSWER is spelled with the format's own types because the journal PRODUCES
 * it and this package may import the floor. A consumer that cannot name
 * `DayGroup` writes the fields it reads and the two agree structurally, which is
 * the same bargain every plugin-owned key takes: the string key names a
 * dependency, it does not check a shape.
 */

import {
  type AgendaDay as FormatAgendaDay,
  agendaOf,
  type DayEntry,
  type DayGroup,
  datedOn,
  isDay,
  type Reading,
} from "@olai/format"
import { Effect } from "effect"

import { name } from "./wire.ts"

/** WHAT IS ASKED: a reading, and the day the answer is about. */
export interface AgendaAsk {
  /** The `Reading` this answer is to be about — opaque for the reason the
   *  header gives, and narrowed here. */
  readonly at: unknown
  /** The day, as the format's own text (`YYYY-MM-DD`). The CALLER's day rather
   *  than the journal's: the dates in the files are what a person wrote down,
   *  so what counts as late is late where the asker is standing — the same
   *  argument `OwedRequest` makes for the wire. */
  readonly date: string
}

/**
 * WHY THERE IS NO ANSWER, in one field a consumer can print.
 *
 * Structural, and deliberately not `@olai/format`'s `OpFailure`: the consumer
 * this door exists for cannot import the floor, and a failure channel it cannot
 * name is a failure channel it cannot handle. One string, which is the whole of
 * what a plugin has to say about it.
 */
export interface AgendaRefused {
  readonly reason: string
}

/**
 * ONE ROW THE ANSWER NAMES — the fields this door promises, and no more.
 *
 * ## Why the answer is the door's own shape and not `@olai/format`'s
 *
 * It WAS the floor's: `dated: ReadonlyArray<DayGroup>` and `agenda: Agenda`,
 * handed straight out of {@link datedOn} and {@link agendaOf} on the argument
 * that the journal produces them and may import the floor. Both halves of that
 * are true and it is still the wrong answer, for a reason that is about TIME
 * rather than about layering.
 *
 * `Agenda` and `DayGroup` are the shape the journal's own PAGES want, and they
 * have revved for drawing reasons — `@olai/format`'s `agenda.ts` records one in
 * its own prose: *"It draws a SPINE now … Which is why what has SLIPPED arrives
 * as days, exactly as what is coming did"*, which is `overdue` changing from
 * groups to days because a page changed its mind. Every reader of that type in
 * this repository is rebuilt in the same commit, so the reshape cost nothing.
 *
 * The readers of THIS door are not. A plugin the vault defines spells the
 * answer structurally, is never recompiled by us, carries no version, and finds
 * out that a field moved by reading `undefined` in somebody's morning. Fusing it
 * to the page's view model would put those two on one clock, and the one that
 * moves is the page's.
 *
 * So the door declares what it promises and satisfies it by PROJECTION at the
 * edge below. A field added to `DayEntry` is invisible here; a field moved or
 * renamed is a type error in THIS file, where a person can decide whether the
 * door changes with it — which is the whole of what a boundary is for. It is
 * `Search`'s arrangement one plugin over, and `Person`'s in `@olai/plugin-api`,
 * arrived at from the other direction.
 *
 * WHAT IS DROPPED is what a sentence has no use for: the ancestry trail, the
 * blockers, the rollup, the line number. A consumer that needs one of those is a
 * reason to widen this deliberately, in a commit that says so.
 */
export interface AgendaRow {
  /** The node's id, so a delivered sentence can point at it. */
  readonly id: string
  /** Its title, verbatim — what a mirror resolves to, never the placement. */
  readonly title: string
  /** The date that put it on this day, verbatim: a bare day, or the instant it
   *  was settled at. */
  readonly date: string
  /** Its mark — `todo`, `doing`, `done`, `cancelled` — or `null` for a row
   *  carrying none, which is an OCCURRENCE and is nobody's late work.
   *
   *  `null` rather than absent, unlike the floor's own optional field: a
   *  consumer spelling this shape by hand reads a nullable field correctly and
   *  mis-reads an optional one, and there is no wire here to drop a key on. */
  readonly status: string | null
}

/** The rows of one outline, on one day. Grouped by file because a `parent` never
 *  crosses one, which is the same reason the pages group by it. */
export interface AgendaGroup {
  readonly file: string
  readonly nodes: ReadonlyArray<AgendaRow>
}

/** One day of the line, and what it owes. */
export interface AgendaDay {
  readonly date: string
  readonly groups: ReadonlyArray<AgendaGroup>
}

/** ...AND THE ANSWER: the day's own rows, and what is owed as of it, both as
 *  located rows — the same shape the day page and the agenda page draw, in this
 *  door's own spelling of it ({@link AgendaRow}). */
export interface AgendaAnswer {
  /** The day this is about, echoed, so a body composed later cannot be about a
   *  day nobody asked for. */
  readonly date: string
  /** Everything on that day, grouped by outline — occurrences included, which
   *  is what makes this the DAY's reading rather than a second copy of
   *  {@link AgendaAnswer.agenda}'s today. */
  readonly dated: ReadonlyArray<AgendaGroup>
  /** What is owed as of that day: the days that have gone and still owe
   *  something, today's unfinished work, and the next days that have anything. */
  readonly agenda: {
    readonly overdue: ReadonlyArray<AgendaDay>
    readonly today: ReadonlyArray<AgendaGroup>
    readonly upcoming: ReadonlyArray<AgendaDay>
  }
}

/** THE DOOR. One verb, because there is one question. */
export interface JournalAgenda {
  readonly read: (ask: AgendaAsk) => Effect.Effect<AgendaAnswer, AgendaRefused>
}

/** The word this plugin offers it under. Composed with the fiber's own name by
 *  the runtime, so `journal.agenda` is never spelled here as a whole. */
export const WORD = "agenda"

/**
 * ...AND THE KEY A CONSUMER NAMES, composed here the way the runtime composes
 * it — off {@link name}, which IS the fiber's word (`@olai/bundle` proves a
 * plugin answers to the id its row is bound under).
 *
 * DERIVED RATHER THAN SPELLED, and the direction matters. This was the literal
 * `"journal.agenda"` with a bench comparing it to `` `journal.${WORD}` `` — two
 * hardcoded spellings of `journal` joined to each other and to nothing, so a
 * rename of this plugin left the constant, the bench, the doc's example, the
 * fixture and the consumer all green and all wrong. Composing it from the same
 * name the runtime reads makes the rename move this string, and the bench holds
 * it against the literal four other files spell.
 */
export const KEY = `${name}.${WORD}`

/**
 * A READING, or nothing — the one narrowing this package does on the opaque
 * side of the door.
 *
 * A CLAIM AND NOT A CHECK, and the two fields tested are the two this answer is
 * built from. It is the same bargain `Vault.revision` states at length: a value
 * that satisfied this and was some other object would answer nonsense, and
 * decoding a whole `Reading` per ask would cost more than the reading itself.
 */
export const readingIn = (at: unknown): Reading | null => {
  if (typeof at !== "object" || at === null) return null
  const held = at as { readonly derived?: unknown }
  return typeof held.derived === "object" && held.derived !== null ? (at as Reading) : null
}

/**
 * THE PROJECTION — the floor's rows read down to what this door promises.
 *
 * This is the boundary {@link AgendaRow} argues for, and it is three lines
 * because that is all a boundary of this kind ever is. The one interesting line
 * is `shows.node`: a `DayEntry` is a SITUATED record, so `shows` is the regular
 * node at the end of however many mirror hops it took to reach it — which is why
 * a mirror of a dated task carries its target's title, date and mark, and why a
 * consumer that reached for a bare record would have to know that.
 */
const rowOf = (entry: DayEntry): AgendaRow => ({
  id: entry.shows.node.id,
  title: entry.shows.node.title,
  date: entry.date,
  // Absent on the floor, `null` here — see {@link AgendaRow.status}.
  status: entry.status ?? null,
})

const groupsOf = (groups: ReadonlyArray<DayGroup>): ReadonlyArray<AgendaGroup> =>
  groups.map((group) => ({ file: group.file, nodes: group.nodes.map(rowOf) }))

const daysOf = (days: ReadonlyArray<FormatAgendaDay>): ReadonlyArray<AgendaDay> =>
  days.map((day) => ({ date: day.date, groups: groupsOf(day.groups) }))

/** The answer, from a reading that has already been narrowed — the whole of
 *  what this door computes, taken out so a bench can spend it without a
 *  fiber. */
export const answerFor = (at: Reading, date: string): AgendaAnswer => {
  const owed = agendaOf(at.derived, date)
  return {
    date,
    dated: groupsOf(datedOn(at.derived, date)),
    agenda: {
      overdue: daysOf(owed.overdue),
      today: groupsOf(owed.today),
      upcoming: daysOf(owed.upcoming),
    },
  }
}

/**
 * THE DOOR THE ROW STANDS BEHIND.
 *
 * Both refusals name what the caller sent, because both are the caller's own
 * mistake and neither is a state of this serve: a date that is not a day, and a
 * value that is not a reading. A journal with no revision yet is NOT one of
 * them — this door is handed the reading, so there is nothing here to be
 * waiting for.
 */
export const door: JournalAgenda = {
  read: ({ at, date }) =>
    Effect.suspend(() => {
      if (!isDay(date)) {
        return Effect.fail({
          reason: `\`${date}\` is not a day (YYYY-MM-DD), so there is no agenda to read for it`,
        })
      }
      const reading = readingIn(at)
      if (reading === null) {
        return Effect.fail({
          reason: "the value handed to `journal.agenda` is not a vault reading — "
            + "pass on what the vault's revision door gave you, unchanged",
        })
      }
      return Effect.succeed(answerFor(reading, date))
    }),
}
