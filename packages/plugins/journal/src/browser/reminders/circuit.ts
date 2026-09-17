/** One effect over the day, its owed reading and the stored choices. Nothing
 * replays a skipped sound: the day is recorded before either device is asked. */
import { type Accessor, createEffect, onCleanup, untrack } from "solid-js"
import type { Owed } from "@olai/format"
import type { Channel } from "olai-plugin-alerts/contract"
import type { Navigation } from "olai-plugin-navigation/contract"
import { agendaRoute } from "../routes.ts"
import type { RemindersState } from "./said.ts"
import { remind } from "./rule.ts"
import { noticeOf } from "./notice.ts"

export const createReminders = (input: {
  readonly today: Accessor<string>
  readonly owed: Accessor<Owed | undefined>
  readonly state: RemindersState
  readonly channel: Pick<Channel, "alertsOn" | "notify" | "chime" | "onPress">
  readonly called: Accessor<string | undefined>
  readonly go: Navigation["go"]
}): void => {
  onCleanup(input.channel.onPress("due", function openAgenda() { input.go(agendaRoute) }))
  createEffect(() => {
    const day = input.today()
    const owed = input.owed()
    const said = input.state.said()
    const on = input.state.on() && input.channel.alertsOn()
    if (!remind(day, owed, said, on)) return
    untrack(() => {
      input.state.say(day)
      void input.channel.notify(noticeOf(day, owed!, input.called()))
      input.channel.chime()
    })
  })
}
