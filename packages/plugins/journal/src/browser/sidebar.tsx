import { createMemo, Show } from "solid-js"

import { CountChip } from "@olai/ui-primitives/CountChip.tsx"
import { ENTRY_SHAPE, HEAD_ACTION } from "olai-plugin-layout/entry"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Link, useRouter } from "olai-plugin-navigation/routing"
import { useToday } from "./clock.ts"

import { TESTID } from "../testids.ts"
import { markOf, unchanged } from "./agenda/owed.ts"
import { Calendar } from "./calendar/Calendar.tsx"
import { calendarOpen, setCalendarOpen } from "./calendar/fold.ts"
import { shortDay } from "./calendar/month.ts"
import { createOwed } from "./dates.ts"
import { agenda, agendaRoute, day, dayRoute, todayRoute } from "./routes.ts"

const createAgendaMark = (today: () => string) => {
  const owed = createOwed(today)
  return createMemo(() => markOf(owed()), undefined, { equals: unchanged })
}

export function AgendaEntry() {
  const router = useRouter()
  const today = useToday()
  const mark = createAgendaMark(today)
  const current = () => agenda.value(router.route()) !== null
  return (
    <div
      class="mb-1"
      data-testid={TESTID.agendaOwed}
      data-owed={mark().face}
      data-overdue={String(mark().owed.overdue)}
      data-today={String(mark().owed.today)}
    >
      <Link
        route={agendaRoute}
        class={`${ENTRY_SHAPE} ${mark().entry}`}
        testid={TESTID.agendaLink}
        current={current()}
        label={mark().said}
        title={mark().said}
      >
        Agenda
        <CountChip count={mark().count} paint={mark().chip} testid={TESTID.agendaCount} />
      </Link>
    </div>
  )
}

/**
 * THE `Today` ROW, and the month folded under it.
 *
 * One row in the column's first doors, under Agenda: `Today` on the left and
 * the date on the right, a link to today's page — where today's cell in the
 * month goes. The chevron beside it is a separate button that opens the month
 * in place below the row and shuts it again; whether it is open is this
 * browser's preference (`./calendar/fold.ts`), shut by default.
 *
 * Two controls rather than one row that does both, because they are two
 * different wishes — go to today, or look at the month — and a row that
 * navigated AND unfolded would do the second to everybody who wanted only the
 * first.
 */
export function TodayEntry() {
  const router = useRouter()
  const today = useToday()
  const open = createMemo(() => {
    const value = day.value(router.route())
    return value === null ? undefined : "today" in value ? today() : value.date
  })
  const grid = "journal-month"
  return (
    <div class="mb-1" data-testid={TESTID.calendarRow} data-open={String(calendarOpen())}>
      <div class="flex items-center gap-1">
        <Link
          route={dayRoute(today())}
          class={`${ENTRY_SHAPE} min-w-0 flex-1`}
          testid={TESTID.calendarToday}
          current={open() === today()}
          title={today()}
        >
          Today
          <span class="ml-auto shrink-0 pl-2 text-body tabular-nums text-paper/60" data-testid={TESTID.calendarTodayDate}>
            {shortDay(today())}
          </span>
        </Link>
        <button
          type="button"
          class={HEAD_ACTION}
          data-testid={TESTID.calendarToggle}
          aria-expanded={calendarOpen()}
          aria-controls={grid}
          aria-label={calendarOpen() ? "hide the month" : "show the month"}
          title={calendarOpen() ? "hide the month" : "show the month"}
          onClick={(event) => {
            // The sidebar body puts the phone drawer away on any click that
            // bubbles to it; unfolding the month is not leaving.
            event.stopPropagation()
            setCalendarOpen(!calendarOpen())
          }}
        >
          <svg viewBox="0 0 16 16" class="size-3.5 transition-transform duration-100" classList={{ "rotate-90": calendarOpen() }} aria-hidden="true" fill="currentColor">
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 1 1-1.06-1.06L9.44 8 6.22 4.28a.75.75 0 0 1 0-1.06z" />
          </svg>
        </button>
      </div>
      <Show when={calendarOpen()}>
        <div id={grid}>
          <Calendar today={today()} open={open()} />
        </div>
      </Show>
    </div>
  )
}

export function JournalRail() {
  const router = useRouter()
  const today = useToday()
  const mark = createAgendaMark(today)
  return (
    <>
      <RailButton
        testid={TESTID.railCalendar}
        label="open today"
        title="today"
        onClick={() => router.go(todayRoute)}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-1V1a.75.75 0 0 0-1.5 0v1h-4V1A.75.75 0 0 0 4.5 1v1h-1zM3.5 6h9v6.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V6z" />
        </svg>
      </RailButton>
      <RailButton
        testid={TESTID.railAgenda}
        label={mark().said ?? "open the agenda"}
        title={mark().said ?? "agenda"}
        data={{ get "data-owed"() { return mark().face } }}
        onClick={() => router.go(agendaRoute)}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M6.25 3.5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75z" />
        </svg>
        <Show when={mark().dot !== ""}>
          <span class={`absolute right-1 top-1 size-2 rounded-full ${mark().dot}`} aria-hidden="true" />
        </Show>
      </RailButton>
    </>
  )
}
