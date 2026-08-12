/**
 * The agenda: what is owed, as a page.
 *
 * A QUERY, not a place — exactly as `/d/<date>` is (../day/DayPage.tsx).
 * Nothing on disk is the agenda: it is every dated node in the served set read
 * forward, at whatever day it is when the page is drawn (`@olai/format`'s
 * `agendaOf`), and the whole of the answer is computed there so that this page
 * and the day pages it links to cannot be two readings of one directory.
 *
 * Three sections, because they are three different pieces of news:
 *
 *   - **Overdue** IS the feature. A slipped task is on a day nobody visits, so
 *     it is the one answer no day page can give.
 *   - **Today** is what today's day page holds, minus what is finished.
 *   - **Upcoming** is the next days that have anything, each heading a link to
 *     that day's own page. Days with nothing do not appear, and how far ahead
 *     it looks is the format's `UPCOMING_DAYS`.
 *
 * An OCCURRENCE — a date with no mark — keeps its place in Today and Upcoming,
 * draws no checkbox (../Checkbox.tsx draws none for a node with no mark) and
 * wears a pill that never turns amber. It can never be in Overdue: a day
 * passing is not a failure of a bullet.
 *
 * ## It writes NOTHING, and the empty state is where that shows
 *
 * The same rule the day page keeps: an empty agenda says "Nothing is due." and
 * offers nothing to press. There is no snooze and no reschedule here —
 * rescheduling is a `date`, and the place to change one is the row where the
 * node actually lives. A page whose whole content is derived would otherwise be
 * offering to edit a thing that is not there.
 */

import { type Agenda, nothingDue } from "@olai/format"
import { For, type JSX, Show } from "solid-js"

import { CRUMB } from "../Breadcrumbs.tsx"
import { DayGroups } from "../day/DayGroups.tsx"
import { Link } from "../router.tsx"
import { TESTID } from "../testids.ts"

export function AgendaPage(props: {
  readonly agenda: Agenda
  /** Today, so the page can say which day it is answering for. Printed
   *  verbatim, like every other date in this app. */
  readonly today: string
}) {
  return (
    <section data-testid={TESTID.agendaPage} data-date={props.today}>
      <header class="mb-4 flex items-baseline gap-2">
        <h1 class="m-0 text-2xl font-bold">Agenda</h1>
        <span class="text-sm text-muted tabular-nums">{props.today}</span>
      </header>

      {/* Said once, as the one condition it is: nothing is late, nothing is on
          today, and nothing is coming. */}
      <Show when={nothingDue(props.agenda)}>
        <p class="text-muted" data-testid={TESTID.agendaEmpty}>
          Nothing is due.
        </p>
      </Show>

      <Section name="overdue" title="Overdue" holds={props.agenda.overdue}>
        <DayGroups groups={props.agenda.overdue} heading="h3" />
      </Section>

      <Section name="today" title="Today" holds={props.agenda.today}>
        <DayGroups groups={props.agenda.today} heading="h3" />
      </Section>

      <Section name="upcoming" title="Upcoming" holds={props.agenda.upcoming}>
        {/* `For` rather than `<Key>`: a day is named by its date, and the
            entries under it are keyed by the record they draw (../day/
            DayGroups.tsx) — so what is stable across frames is already held one
            level down. */}
        <For each={props.agenda.upcoming}>
          {(day) => (
            <section
              class="mb-4"
              data-testid={TESTID.agendaDay}
              data-date={day.date}
            >
              {/* The heading is the way THROUGH: a day page is the fuller
                  answer — the note somebody wrote on it, and the work that is
                  already finished — and this page deliberately shows neither. */}
              <h3 class="m-0 mb-2 text-sm font-semibold tabular-nums">
                <Link route={{ kind: "day", date: day.date }} class={CRUMB}>
                  {day.date}
                </Link>
              </h3>
              <DayGroups groups={day.groups} heading="h4" />
            </section>
          )}
        </For>
      </Section>
    </section>
  )
}

/**
 * One section of the page, drawn only when it has something in it.
 *
 * An empty section is not drawn at all rather than drawn saying it is empty:
 * three headings with nothing under two of them is a page a reader has to
 * decode, and the one thing worth saying about an agenda with nothing on it is
 * said once, above. It takes WHAT IT HOLDS rather than whether to draw, so that
 * rule is spelled here once instead of at each of the three — the sections hold
 * two different shapes (groups, days) and neither of them decides this.
 *
 * `data-section` names which of the three it is, so a scenario asks for a
 * section by what it MEANS rather than by the words it happens to be titled
 * with — the same promise every other `data-` fact on this page makes.
 */
function Section(props: {
  readonly name: "overdue" | "today" | "upcoming"
  readonly title: string
  readonly holds: ReadonlyArray<unknown>
  readonly children: JSX.Element
}) {
  return (
    <Show when={props.holds.length > 0}>
      <section
        class="mb-8"
        data-testid={TESTID.agendaSection}
        data-section={props.name}
      >
        <h2 class="m-0 mb-3 text-xs uppercase tracking-wide text-muted">
          {props.title}
        </h2>
        {props.children}
      </section>
    </Show>
  )
}
