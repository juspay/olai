import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import type { Drawn } from "@olai/web/client/page.ts"
import { only } from "@olai/web/client/narrow.ts"
import { defineAppPage } from "@olai/web/client/routes.ts"
import type { Shown } from "@olai/format"
import { Effect } from "effect"

import { AgendaPage } from "./browser/agenda/AgendaPage.tsx"
import { DayPage } from "./browser/day/DayPage.tsx"
import { AgendaEntry, CalendarSection, JournalRail } from "./browser/sidebar.tsx"
import { agenda as agendaKind, day as dayKind } from "./browser/routes.ts"
import { type JournalClient, holdJournalWire } from "./browser/wire.ts"
import { name, surface } from "./wire.ts"

export { name, surface } from "./wire.ts"

function DayFace(props: {
  readonly page: Extract<Shown, { readonly kind: "day" }>
  readonly drawn: Drawn
  readonly today: string
}) {
  const drawn = () => only(props.drawn, "day")
  return (
    <DayPage
      date={props.page.date}
      groups={drawn()?.groups ?? []}
      notes={drawn()?.notes ?? []}
      noted={props.page.notes.length > 0}
      today={props.today}
    />
  )
}

function AgendaFace(props: {
  readonly page: Extract<Shown, { readonly kind: "agenda" }>
  readonly drawn: Drawn
  readonly today: string
}) {
  const drawn = () => only(props.drawn, "agenda")?.agenda
  return <>{drawn() === undefined ? null : <AgendaPage agenda={drawn()!} today={props.page.date} />}</>
}

export default definePlugin({
  name,
  needs: [Slots, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const wired = yield* Wired
    holdJournalWire(() => wired.client() as JournalClient)

    yield* slots.register("app.route", defineAppPage(dayKind, DayFace))
    yield* slots.register("app.route", defineAppPage(agendaKind, AgendaFace))
    yield* slots.register("sidebar.entry", {
      place: "top",
      body: AgendaEntry,
      rail: JournalRail,
    })
    yield* slots.register("sidebar.section", { said: "Calendar", body: CalendarSection })
    yield* slots.register("app.palette", {
      id: "nav-today",
      label: "Go to today",
      hint: "journal for this day",
      search: "go to today journal day calendar",
      href: dayKind.href({ today: true }),
    })
    yield* slots.register("app.palette", {
      id: "nav-agenda",
      label: "Go to the agenda",
      hint: "what is due",
      search: "go to agenda due overdue upcoming owed",
      href: agendaKind.href({}),
    })
  }),
})
