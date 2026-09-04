import { createMemo, Show } from "solid-js"

import { CountChip } from "@olai/web/client/layout/CountChip.tsx"
import { ENTRY_SHAPE } from "@olai/web/client/layout/entry.ts"
import { RailButton } from "@olai/web/client/layout/Rail.tsx"
import { Link, useRouter } from "@olai/web/client/router.tsx"
import { useToday } from "@olai/web/client/today.tsx"

import { TESTID } from "../testids.ts"
import { markOf, unchanged } from "./agenda/owed.ts"
import { Calendar } from "./calendar/Calendar.tsx"
import { createOwed } from "./dates.ts"
import { agendaRoute, todayRoute } from "./routes.ts"

export function AgendaEntry() {
  const router = useRouter()
  const today = useToday()
  const owed = createOwed(() => today())
  const mark = createMemo(() => markOf(owed()), undefined, { equals: unchanged })
  const current = () => {
    const route = router.route()
    return route.kind === "plugin" && route.plugin === "journal" && route.page === "agenda"
  }
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

export function CalendarSection() {
  const router = useRouter()
  const today = useToday()
  const open = createMemo(() => {
    const route = router.route()
    if (route.kind !== "plugin" || route.plugin !== "journal" || route.page !== "day") {
      return undefined
    }
    const value = route.value as { readonly today?: true; readonly date?: string }
    return value.today === true ? today() : value.date
  })
  return <Calendar today={today()} open={open()} />
}

export function JournalRail() {
  const router = useRouter()
  const today = useToday()
  const owed = createOwed(() => today())
  const mark = createMemo(() => markOf(owed()), undefined, { equals: unchanged })
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
        owed={mark().face}
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
