import type { Router } from "olai-plugin-navigation/routing"
import { createEffect, mapArray, onCleanup } from "solid-js"
import { agentReadings } from "../../agents/reading.ts"
import { useChannel } from "../../channel.ts"
import { createReveal } from "./reveal.ts"
import { noticeOf } from "./notice.ts"
import { createWatchings } from "./watching.ts"
import { alarmFor, type Awaiting } from "./alarm.ts"
import type { Row } from "../../agents/roster.ts"

/** One circuit per node, all owned by the attention activation. */
export const createAttention = (router: Router): void => {
  const createWatching = createWatchings()
  const alerts = useChannel()
  const reveal = createReveal(router)
  onCleanup(alerts.onPress("ask", reveal))
  const badges = new Map<string, number>()
  const wear = () => alerts.wear([...badges.values()].reduce((a, b) => a + b, 0))
  onCleanup(() => alerts.wear(0))
  const circuits = mapArray(() => agentReadings()?.agents.rows().map(row => row.id) ?? [], id => {
        onCleanup(() => { badges.delete(id); wear() })
        const reading = () => agentReadings()?.agents.at(id)
        const currentChat = () => {
          const held = agentReadings()
          const current = reading()
          if (held === undefined || current?.session == null) return undefined
          return [...(held.at(id) ?? [])].find(chat => held.isShown(chat) && chat.state().session?.id === current.session)
        }
        const watched = createWatching(() => currentChat() !== undefined, id)
        createEffect<Awaiting | undefined>(before => {
          const now: Row | undefined = reading()
          const next = { count: now?.waiting ?? 0, watched: watched() }
          const alarm = alarmFor(before, next)
          badges.set(id, alarm.badge)
          wear()
          if (alarm.alert && now !== undefined) {
            alerts.chime()
            const chat = currentChat()
            void alerts.notify({ ...noticeOf({ session: null, asking: now.waiting }, chat?.ui.question.value(), now.title),
              tag: `olai:awaiting:${now.id}`, title: now.title })
          }
          return next
        })
  })
  createEffect(() => { circuits() })
}
