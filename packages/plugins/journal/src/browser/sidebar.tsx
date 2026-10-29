import { createMemo, Show } from "solid-js"

import { CountChip } from "@olai/ui-primitives/CountChip.tsx"
import { ENTRY_SHAPE, HEAD_ACTION } from "olai-plugin-layout/entry"
import { RailButton } from "@olai/ui-primitives/RailButton.tsx"
import { Link, useRouter } from "olai-plugin-navigation/routing"
import { useToday } from "./clock.ts"

import { TESTID } from "../testids.ts"
import { agendaRowsFolded } from "./agenda/fold.ts"
import { markOf, unchanged } from "./agenda/owed.ts"
import { AgendaFold, AgendaRows } from "./agenda/rows.tsx"
import { Calendar } from "./calendar/Calendar.tsx"
import { calendarOpen, setCalendarOpen } from "./calendar/fold.ts"
import { shortDay } from "./calendar/month.ts"
import { owedToday } from "./owed.ts"
import { agenda, agendaRoute, day, dayRoute, todayRoute } from "./routes.ts"

const createAgendaMark = (today: () => string) => {
  const owed = owedToday
  return createMemo(() => markOf(owed()), undefined, { equals: unchanged })
}

/**
 * THE `Agenda` DOOR, and what is owed folded under it.
 *
 * The door is the chip and the way to the page; the list under it is the same
 * reading as rows, so a reader working in an outline sees WHAT slipped without
 * leaving the page (`./agenda/rows.tsx`). Three things decide whether the list
 * is drawn, and each is a different fact:
 *
 *   - IS ANYTHING OWED — nothing late and nothing on today is the plain door it
 *     has always been, with no list and no chevron;
 *   - IS THE AGENDA IN FRONT — the page is the fuller answer to the same
 *     question, so the column does not repeat it; the count stays, because the
 *     door is still a door;
 *   - HAS THE READER FOLDED IT — this browser's preference
 *     (`./agenda/fold.ts`), followed across tabs by the activation. Folding
 *     never stops the reading, which is what keeps the count live while shut.
 *
 * The chevron is a control of its own, beside the link rather than inside it,
 * for the reason the month's is: "go to the agenda" and "put the list away" are
 * two wishes, and a row that did both would spend the second on everybody who
 * wanted the first.
 */
export function AgendaEntry() {
  const router = useRouter()
  const today = useToday()
  const mark = createAgendaMark(today)
  const reading = owedToday
  const current = () => agenda.value(router.route()) !== null
  /** The list is drawn exactly when the mark is not quiet and the page is not
   *  the one in front — one condition, before the fold, so the chevron and the
   *  region it controls cannot come apart. */
  const shown = () => mark().face !== "quiet" && !current()
  const rows = createMemo(() => reading()?.rows ?? [])
  /** What is owed but not drawn: the two counts are the whole truth and the
   *  rows are a (capped) projection of it — so this is arithmetic over one
   *  reading rather than a second question. */
  const more = createMemo(() => {
    const owed = reading()
    return owed === undefined ? 0 : Math.max(owed.overdue + owed.today - owed.rows.length, 0)
  })
  return (
    <div
      class="mb-1"
      data-testid={TESTID.agendaOwed}
      data-owed={mark().face}
      data-overdue={String(mark().owed.overdue)}
      data-today={String(mark().owed.today)}
    >
      <div class="flex items-center gap-1">
        <Link
          route={agendaRoute}
          class={`${ENTRY_SHAPE} ${mark().entry} min-w-0 flex-1`}
          testid={TESTID.agendaLink}
          current={current()}
          label={mark().said}
          title={mark().said}
        >
          Agenda
          <CountChip count={mark().count} paint={mark().chip} testid={TESTID.agendaCount} />
        </Link>
        <Show when={shown()}>
          <AgendaFold />
        </Show>
      </div>
      <Show when={shown() && !agendaRowsFolded()}>
        <AgendaRows rows={rows()} more={more()} today={today()} />
      </Show>
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
          <span class="ml-auto shrink-0 pl-2 text-label tabular-nums text-muted" data-testid={TESTID.calendarTodayDate}>
            {shortDay(today())}
          </span>
        </Link>
        <button
          type="button"
          class={HEAD_ACTION}
          data-testid={TESTID.calendarToggle}
          aria-expanded={calendarOpen()}
          aria-controls={grid}
          aria-label={calendarOpen() ? "Hide month" : "Show month"}
          title={calendarOpen() ? "Hide month" : "Show month"}
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
        label="Open today"
        title="Today"
        href={router.routes.href(todayRoute)}
      >
        <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true" fill="currentColor">
          <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-1V1a.75.75 0 0 0-1.5 0v1h-4V1A.75.75 0 0 0 4.5 1v1h-1zM3.5 6h9v6.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V6z" />
        </svg>
      </RailButton>
      <RailButton
        testid={TESTID.railAgenda}
        label={mark().said ?? "Open Agenda"}
        title={mark().said ?? "Agenda"}
        data={{ get "data-owed"() { return mark().face } }}
        href={router.routes.href(agendaRoute)}
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
