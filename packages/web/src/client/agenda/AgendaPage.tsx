/**
 * The agenda: what is owed, as a page.
 *
 * A QUERY, not a place — exactly as `/d/<date>` is (../day/DayPage.tsx).
 * Nothing on disk is the agenda: it is every dated node in the served set read
 * forward, at whatever day it is when the page is drawn (`@olai/format`'s
 * `agendaOf`), and the whole of the answer is computed there so that this page
 * and the day pages it links to cannot be two readings of one directory.
 *
 * ## ONE SPINE OF TIME, and what it replaced
 *
 * It drew three boxes — Overdue, Today, Upcoming — until `agenda-spine` (ruled
 * 2026-08-18, from a three-way design exploration). Flat sections gave every
 * item an equal claim on attention, so a task seventy-three days out shouted as
 * loudly as one due on Monday; ISO dates made a reader subtract to feel any
 * urgency at all; and the repeated chrome — a file heading and a crumb per day
 * — outweighed the content about four to one.
 *
 * What is here instead is one continuous line (./Spine.tsx) with NOW marked on
 * it: days above it have gone, days below it recede — fainter ink, fainter
 * rows, and the silences between them drawn as silence. Nothing was added to
 * the reading to do it. The same three fields arrive from the format; they are
 * where a day sits relative to now rather than three headings to file it under.
 *
 * ## It writes NOTHING, and the empty state is where that shows
 *
 * The same rule the day page keeps: an empty agenda says "Nothing is due.",
 * draws no line at all, and offers nothing to press. There is no snooze and no
 * reschedule here — rescheduling is a `date`, and the place to change one is
 * the row where the node actually lives. A page whose whole content is derived
 * would otherwise be offering to edit a thing that is not there.
 *
 * A LONE TODAY DOT over an empty page is not what "now is a place on the line"
 * asks for: a line with one dot and nothing either side of it is a diagram of
 * nothing. So the line is drawn exactly when something is owed, and now is on
 * it whenever it is drawn.
 *
 * ## The filter takes rows out of it, and takes nothing off the entry
 *
 * The reading is narrowed by the box above (`../filter/narrowing.ts`), which is
 * `keepingOwed` over the answer this page was already handed — so a day left
 * with nothing simply stops being drawn, and the silences either side of it
 * close up into one longer wait, computed from the days that are still there.
 *
 * What does NOT move is the mark in the directory column: what is owed is a
 * fact about the directory and the filter is a question about the open page, so
 * the entry goes on saying "3 overdue" over a page narrowed to one of them
 * (`./owed.ts` counts the unnarrowed reading, in `../App.tsx`).
 *
 * "Nothing is due." is not said over a filtered page either — it is a claim
 * about the agenda, where "no matches" is a claim about the query, and the bar
 * is where that one is made.
 */

import { type Agenda, nothingDue } from "@olai/format"
import { Show } from "solid-js"

import { unfiltered, useNarrowed } from "../filter/narrowed.tsx"
import { TESTID } from "../testids.ts"
import { Spine } from "./Spine.tsx"

export function AgendaPage(props: {
  readonly agenda: Agenda
  /** Today, so the page can say which day it is answering for. Printed
   *  verbatim, like every other date in this app — and it is the one ISO date
   *  left on the page, because it is the page's own claim rather than a fact
   *  about a row. */
  readonly today: string
}) {
  const narrowed = useNarrowed()
  const owed = () => !nothingDue(props.agenda)

  return (
    <section data-testid={TESTID.agendaPage} data-date={props.today}>
      <header class="mb-6 flex items-baseline gap-2">
        <h1 class="m-0 text-2xl font-bold">Agenda</h1>
        <span class="text-sm text-muted tabular-nums">{props.today}</span>
      </header>

      {/* Said once, as the one condition it is: nothing is late, nothing is on
          today, and nothing is coming. Never over a filter, which empties this
          page for a reason of its own and says so in its own words — the one
          reading every page with a sentence like this is drawn on
          (`../filter/narrowed.tsx`). */}
      <Show when={unfiltered(narrowed) && nothingDue(props.agenda)}>
        <p class="text-muted" data-testid={TESTID.agendaEmpty}>
          Nothing is due.
        </p>
      </Show>

      <Show when={owed()}>
        <Spine agenda={props.agenda} today={props.today} />
      </Show>
    </section>
  )
}
