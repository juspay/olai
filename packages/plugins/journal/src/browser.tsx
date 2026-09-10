import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-sidebar/slots"
import {Clocks} from "@olai/plugin-api"
import {fileAccess} from "olai-plugin-vault/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { holdLocations } from "./browser/locations.ts"
import { documentEditing } from "olai-plugin-markdown/contract"
import { holdDocumentActions } from "./browser/editing.ts"
import { holdServed } from "./browser/vault.ts"
import { holdClocks } from "./browser/clock.ts"
import { propertyRoutes } from "olai-plugin-outlines/contract"
import { definePlugin, Slots, Wired } from "@olai/plugin-api"
import type { Drawn } from "olai-plugin-outlines/page"
import { only } from "@olai/web/client/narrow.ts"
import { defineAppPage } from "olai-plugin-navigation/routes"
import type { Shown } from "@olai/format"
import { Effect } from "effect"

import { AgendaPage } from "./browser/agenda/AgendaPage.tsx"
import { DayPage } from "./browser/day/DayPage.tsx"
import { AgendaEntry, CalendarSection, JournalRail } from "./browser/sidebar.tsx"
import { agenda as agendaKind, day as dayKind, dayRoute } from "./browser/routes.ts"
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
  needs: [Slots, Wired, fileAccess, Clocks, rendererSlots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    // A day row and a day's note are other rows' contributions; this row walks
    // their locations through the renderer it already names
    // (`./browser/locations.ts`).
    const locations = yield* rendererSlots
    yield* Effect.acquireRelease(Effect.sync(() => holdLocations(locations.read)), stop => Effect.sync(stop))
    // The served directory, held for this activation (`./browser/vault.ts`).
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))
    // ...and the clock a day is drawn against (`./browser/clock.ts`).
    const clock = yield* Clocks
    yield* Effect.acquireRelease(Effect.sync(() => holdClocks(clock)), stop => Effect.sync(stop))
    const wired = yield* Wired
    yield* holdJournalWire(() => wired.client() as JournalClient)

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

/** Date-property navigation is an integration, independent of journal readings. */
export const components = {
  /** Where a minted note is opened, DECLARED — a component of its own so the
   *  calendar, the agenda and every day page keep working with no document row
   *  mounted (`./browser/editing.ts`). */
  editing: definePlugin({ name: "editing", needs: [documentEditing], apply: Effect.gen(function*() {
    const actions = yield* documentEditing
    yield* Effect.acquireRelease(Effect.sync(() => holdDocumentActions(actions)), stop => Effect.sync(stop))
  }) }),
  properties: definePlugin({ name: "properties", needs: [rendererSlots], apply: Effect.gen(function*() {
    // THE ROW'S OWN CONSTRUCTOR, not a round trip through the app's live URL
    // parser: `day.to` is `defineAppRoute`'s pure answer for this row's own
    // page (`./browser/routes.ts`), and asking the grammar to parse a URL this
    // row had just spelled made the answer depend on whether this row's own
    // claim had settled in the renderer yet.
    yield* (yield* rendererSlots).contribute(propertyRoutes, meaning => meaning.kind === "day" ? dayRoute(meaning.date) : undefined)
  }) }),
}
