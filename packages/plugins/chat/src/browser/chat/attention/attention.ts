import type { Router } from "olai-plugin-navigation/routing"
import { grumble } from "@olai/web/client/grumble.ts"
import { run } from "@olai/web/client/run.ts"
import { createEffect, createMemo, mapArray, onCleanup } from "solid-js"
import { agentReadings } from "../../agents/reading.ts"
import { useChannel } from "../../channel.ts"
import { chatWire } from "../../wire.ts"
import { createReveal } from "./reveal.ts"
import { noticeOf } from "./notice.ts"
import { createWatchings } from "./watching.ts"
import { alarmFor, type Awaiting } from "./alarm.ts"
import type { Row } from "../../agents/roster.ts"

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
        const currentChat = () => agentReadings()?.shownChat(id)
        const watching = createWatching(() => currentChat() !== undefined, id)
        createEffect<Awaiting | undefined>(before => {
          const now: Row | undefined = reading()
          const next = { count: now?.waiting ?? 0, watched: watching.anyoneWatching() }
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
        const unreadLine = createMemo(() => {
          const now = reading()
          const said = now?.said ?? null
          return now === undefined || said === null || now.session === null || !now.unread
            ? null
            : { agent: now.engine, session: now.session, at: said.at }
        }, null, {
          equals: (was, now) => was?.agent === now?.agent && was?.session === now?.session && was?.at === now?.at,
        })
        createEffect(() => {
          const line = unreadLine()
          if (line === null || !watching.watchingHere()) return
          run(
            chatWire().procedures.conversation.seen(line),
            failure => grumble(`chat.seen:${id}`, "olai: this conversation could not be marked as read", failure),
          )
        })
  })
  createEffect(() => { circuits() })
}
