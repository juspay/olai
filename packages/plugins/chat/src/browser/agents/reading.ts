import { createPreviews } from "../chat/previews.ts"
import { createEffect, createRoot, createSignal, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Conversing } from "../../sessions.ts"
import { createConversationUI } from "../chat/ui.tsx"
import type { Chat } from "../chat/state.ts"
import type { Roster } from "./answered.tsx"

export const createAgentReadings = (agents: Roster) => {
  const previews = createPreviews()
  const reveals = new Set<string>()
  const cache = new Map<string, ReturnType<typeof createConversationUI>>()
  const [visits, setVisits] = createSignal<ReadonlyMap<string, Conversing>>(new Map())
  const waiting = new Set<() => void>()
  let alive = true
  onCleanup(() => { alive = false; for (const stop of [...waiting]) stop(); cache.clear() })
  const ui = (to: Conversing) => {
    const key = JSON.stringify([to.agent, to.session])
    let value = cache.get(key)
    if (value === undefined) { value = createConversationUI(previews); cache.set(key, value) }
    return value
  }
  const [readings, setReadings] = createSignal<ReadonlyMap<string, ReadonlySet<Chat>>>(new Map())
  return {
    agents, ui,
    visiting: (node: string) => visits().get(node),
    visit: (node: string, to?: Conversing) => setVisits(before => {
      const next = new Map(before)
      if (to === undefined) next.delete(node)
      else next.set(node, to)
      return next
    }),
    ready: (node: string, to: Conversing): Promise<Chat | string> => new Promise(resolve => {
      if (!alive) { resolve("chat stopped"); return }
      createRoot(dispose => {
        const stop = () => { waiting.delete(stop); dispose(); resolve("chat stopped") }
        waiting.add(stop)
        createEffect(() => {
          const current = agents.at(node)
          if (current === undefined || current.engine !== to.agent || current.session !== to.session) {
            waiting.delete(stop); dispose(); resolve("the agent's session changed — try again"); return
          }
          const chat = [...(readings().get(node) ?? [])].find(chat => chat.ui === ui(to))
          if (chat === undefined) return
          const state = chat.state()
          if (state.unopened) {
            waiting.delete(stop); dispose(); resolve("the conversation could not be opened"); return
          }
          if (state.session?.id !== to.session || state.uploadScope === null) return
          waiting.delete(stop); dispose(); resolve(chat)
        })
      })
    }),
    reveal: (node: string) => {
      const live = readings().get(node)
      if (live === undefined) reveals.add(node)
      else for (const chat of live) chat.ui.reveal[1](true)
    },
    at: (node: string) => readings().get(node),
    join: (node: string, chat: Chat) => {
      if (reveals.delete(node)) chat.ui.reveal[1](true)
      setReadings(before => new Map(before).set(node, new Set([...(before.get(node) ?? []), chat])))
      onCleanup(() => setReadings(before => {
        const next = new Map(before)
        const members = new Set(next.get(node))
        members.delete(chat)
        if (members.size === 0) next.delete(node)
        else next.set(node, members)
        return next
      }))
    },
  }
}
const held = heldService<ReturnType<typeof createAgentReadings>>()
export const holdAgentReadings = held.hold
export const agentReadings = held.read
export const readAgent = (node: string, chat: Chat) => held.read()?.join(node, chat)
