import type { Router } from "olai-plugin-navigation/routing"
import { createEffect, createRoot, onCleanup } from "solid-js"
import { agentReadings } from "../../agents/reading.ts"
import { useChannel } from "../../channel.ts"
import { createReveal } from "./reveal.ts"
import { noticeOf } from "./notice.ts"
import { createWatching } from "./watching.ts"
import { alarmFor, type Awaiting } from "./alarm.ts"
import type { Row } from "../../agents/roster.ts"

/** One circuit per node, all owned by the attention activation. */
export const createAttention = (router: Router): void => {
  const alerts = useChannel()
  const reveal = createReveal(router)
  onCleanup(alerts.onPress("ask", reveal))
  const badges = new Map<string, number>()
  const wear = () => alerts.wear([...badges.values()].reduce((a, b) => a + b, 0))
  const circuits = new Map<string, () => void>()
  onCleanup(() => { for (const stop of circuits.values()) stop(); alerts.wear(0) })
  createEffect(() => {
    const held = agentReadings()
    const rows = held?.agents.rows() ?? []
    const ids = new Set(rows.map(row => row.id))
    for (const [id, stop] of circuits) if (!ids.has(id)) { stop(); circuits.delete(id); badges.delete(id); wear() }
    for (const row of rows) {
      if (circuits.has(row.id)) continue
      circuits.set(row.id, createRoot(dispose => {
        const reading = () => agentReadings()?.agents.at(row.id)
        const currentChat = () => {
          const held = agentReadings()
          const current = reading()
          if (held === undefined || current?.session == null) return undefined
          const ui = held.ui({ agent: current.engine, session: current.session })
          return [...(held.at(row.id) ?? [])].find(chat => chat.ui === ui)
        }
        const watched = createWatching(() => currentChat() !== undefined, row.id)
        createEffect<Awaiting | undefined>(before => {
          const now: Row | undefined = reading()
          const next = { count: now?.waiting ?? 0, watched: watched() }
          const alarm = alarmFor(before, next)
          badges.set(row.id, alarm.badge)
          wear()
          if (alarm.alert && now !== undefined) {
            alerts.chime()
            const chat = currentChat()
            void alerts.notify({ ...noticeOf({ session: null, asking: now.waiting }, chat?.ui.question[0](), now.title),
              tag: `olai:awaiting:${now.id}`, title: now.title })
          }
          return next
        })
        return dispose
      }))
    }
  })
}
