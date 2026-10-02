import { createStore } from "solid-js/store"
import { createNewChat } from "./new-chat.ts"
import { createPreviews } from "../chat/previews.ts"
import { createEffect, createRoot, getOwner, runWithOwner, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PanelAddress } from "../../wire/session.ts"
import type { Conversing } from "../../sessions.ts"
import { createConversationUI } from "../chat/ui.tsx"
import type { Chat } from "../chat/state.ts"
import type { Roster } from "./answered.tsx"
import { createPageOwners } from "./page-owners.ts"
import type { PageSession } from "./Page.tsx"

export const createAgentReadings = (agents: Roster) => {
  const newChat = createNewChat()
  const page = createPageOwners<PageSession>()
  const previews = createPreviews()
  const reveals = new Set<string>()
  const shown = new Map<Chat, () => boolean>()
  const owner = getOwner()
  const cache = new Map<string, { value: ReturnType<typeof createConversationUI>; dispose: () => void }>()
  const joined = new Map<ReturnType<typeof createConversationUI>, number>()
  const [visits, setVisits] = createStore<Record<string, Conversing | undefined>>({})
  const waiting = new Set<() => void>()
  const needsSurfaces = new Set<HTMLElement>()
  let alive = true
  onCleanup(() => { alive = false; for (const stop of [...waiting]) stop(); for (const entry of cache.values()) entry.dispose(); cache.clear() })
  const ui = (to: PanelAddress) => {
    const key = JSON.stringify("session" in to ? [to.agent, to.session] : ["node", to.node])
    let entry = cache.get(key)
    if (entry === undefined) {
      entry = runWithOwner(owner, () => createRoot(dispose => ({ value: createConversationUI(previews), dispose })))!
      cache.set(key, entry)
    }
    return entry.value
  }
  const releaseUI = (value: ReturnType<typeof createConversationUI>) => {
    const count = (joined.get(value) ?? 1) - 1
    if (count > 0) { joined.set(value, count); return }
    joined.delete(value)
    if ([...value.messages.values()].some(([read]) => read().text !== "") ||
        [...value.holding.values()].some(bin => bin.pending().length > 0 || bin.sending() > 0) ||
        !value.drafts.empty() || value.pendingSends[0]() > 0) return
    for (const [key, entry] of cache) if (entry.value === value) {
      cache.delete(key)
      entry.dispose()
    }
  }

  const [readings, setReadings] = createStore<Record<string, ReadonlySet<Chat> | undefined>>({})
  return {
    agents, ui, page, newChat,
    needsSurface: (element: HTMLElement) => {
      needsSurfaces.add(element)
      onCleanup(() => needsSurfaces.delete(element))
    },
    focusNeeds: () => { [...needsSurfaces].find(element => element.isConnected && element.getClientRects().length > 0)?.focus() },
    visiting: (node: string) => visits[node],
    visit: (node: string, to?: Conversing) => { setVisits(node, to) },
    ready: (node: string, to: Conversing): Promise<Chat | string> => new Promise(resolve => {
      if (!alive) { resolve("Chat stopped"); return }
      createRoot(dispose => {
        const stop = () => { waiting.delete(stop); dispose(); resolve("Chat stopped") }
        waiting.add(stop)
        createEffect(() => {
          const current = agents.at(node)
          if (current === undefined || current.engine !== to.agent || current.session !== to.session) {
            waiting.delete(stop); dispose(); resolve("The agent's chat changed. Try again."); return
          }
          const chat = [...(readings[node] ?? [])].find(chat => chat.ui === ui(to))
          if (chat === undefined) return
          const state = chat.state()
          if (state.unopened) {
            waiting.delete(stop); dispose(); resolve("Couldn't open the chat"); return
          }
          if (state.session?.id !== to.session || state.uploadScope === null) return
          waiting.delete(stop); dispose(); resolve(chat)
        })
      })
    }),
    reveal: (node: string) => {
      const live = [...(readings[node] ?? [])].filter(chat => shown.get(chat)?.())
      if (live.length === 0) reveals.add(node)
      else for (const chat of live) chat.ui.reveal[1](true)
    },
    at: (node: string) => readings[node],
    isShown: (chat: Chat) => shown.get(chat)?.() === true,
    join: (node: string, chat: Chat, visible: () => boolean) => {
      joined.set(chat.ui, (joined.get(chat.ui) ?? 0) + 1)
      shown.set(chat, visible)
      createEffect(() => { if (visible() && reveals.delete(node)) chat.ui.reveal[1](true) })
      setReadings(node, new Set([...(readings[node] ?? []), chat]))
      onCleanup(() => {
        shown.delete(chat)
        releaseUI(chat.ui)
        const members = new Set(readings[node])
        members.delete(chat)
        setReadings(node, members.size === 0 ? undefined : members)
      })
    },
  }
}
const held = heldService<ReturnType<typeof createAgentReadings>>()
export const holdAgentReadings = held.hold
export const agentReadings = held.read
export const readAgent = (node: string, chat: Chat, shown: () => boolean = () => true) => held.read()?.join(node, chat, shown)
