/**
 * THE JOURNAL'S TWO THUMBS — today's page and the agenda — in the phone's
 * bottom bar (`olai-plugin-layout`'s `layout.thumbs`).
 *
 * The same two doors the sidebar's first rows are, reached with a thumb
 * instead of a drawer. The agenda's thumb carries the owed count the entry
 * carries (`./agenda/owed.ts`), and only while something is late or on
 * today: a bar that counted zero would be a bar that nagged.
 */
import { Show } from "solid-js"

import { Thumb } from "olai-plugin-layout/thumb"
import { useRouter } from "olai-plugin-navigation/routing"

import { TESTID } from "../testids.ts"
import { markOf } from "./agenda/owed.ts"
import { useToday } from "./clock.ts"
import { owedToday } from "./owed.ts"
import { agenda, agendaRoute, day, dayRoute } from "./routes.ts"

export function TodayThumb() {
  const router = useRouter()
  const today = useToday()
  const open = () => {
    const value = day.value(router.route())
    return value !== null && ("today" in value || value.date === today())
  }
  return (
    <Thumb label="Today" testid={TESTID.thumbToday} href={router.routes.href(dayRoute(today()))} current={open()}>
      <svg viewBox="0 0 16 16" class="size-5" aria-hidden="true" fill="currentColor">
        <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-1V1a.75.75 0 0 0-1.5 0v1h-4V1A.75.75 0 0 0 4.5 1v1h-1zM3.5 6h9v6.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V6z" />
      </svg>
    </Thumb>
  )
}

export function AgendaThumb() {
  const router = useRouter()
  const mark = () => markOf(owedToday())
  return (
    <Thumb
      label="Agenda"
      testid={TESTID.thumbAgenda}
      href={router.routes.href(agendaRoute)}
      current={agenda.value(router.route()) !== null}
      data={{ "data-owed": mark().face }}
      badge={<Show when={mark().count > 0}>{mark().count}</Show>}
    >
      <svg viewBox="0 0 16 16" class="size-5" aria-hidden="true" fill="currentColor">
        <path d="M6.25 3.5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zm0 5a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H7a.75.75 0 0 1-.75-.75zM3 3.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
      </svg>
    </Thumb>
  )
}
