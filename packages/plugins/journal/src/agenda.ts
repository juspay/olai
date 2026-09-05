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
  type Agenda,
  agendaOf,
  type DayGroup,
  datedOn,
  isDay,
  type Reading,
} from "@olai/format"
import { Effect } from "effect"

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

/** ...AND THE ANSWER: the day's own rows, and what is owed as of it, both as
 *  located rows — the same values the day page and the agenda page draw. */
export interface AgendaAnswer {
  /** The day this is about, echoed, so a body composed later cannot be about a
   *  day nobody asked for. */
  readonly date: string
  /** Everything on that day, grouped by outline — occurrences included, which
   *  is what makes this the DAY's reading rather than a second copy of
   *  {@link AgendaAnswer.agenda}'s today. */
  readonly dated: ReadonlyArray<DayGroup>
  /** What is owed as of that day: the days that have gone and still owe
   *  something, today's unfinished work, and the next days that have anything. */
  readonly agenda: Agenda
}

/** THE DOOR. One verb, because there is one question. */
export interface JournalAgenda {
  readonly read: (ask: AgendaAsk) => Effect.Effect<AgendaAnswer, AgendaRefused>
}

/** The word this plugin offers it under. Composed with the fiber's own name by
 *  the runtime, so `journal.agenda` is never spelled here as a whole. */
export const WORD = "agenda"

/** ...and the key a consumer names, spelled once for the doc and the bench.
 *  It is a claim about what the runtime composes, not the composition itself. */
export const KEY = "journal.agenda"

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

/** The answer, from a reading that has already been narrowed — the whole of
 *  what this door computes, taken out so a bench can spend it without a
 *  fiber. */
export const answerFor = (at: Reading, date: string): AgendaAnswer => ({
  date,
  dated: datedOn(at.derived, date),
  agenda: agendaOf(at.derived, date),
})

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
