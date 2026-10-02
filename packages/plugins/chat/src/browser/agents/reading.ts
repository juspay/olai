import { createStore } from "solid-js/store"
import { createNewChat } from "./new-chat.ts"
import { createPreviews } from "../chat/previews.ts"
import { createEffect, createRoot, getOwner, runWithOwner, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"
import type { PanelAddress } from "../../wire/session.ts"
import type { Conversing } from "../../sessions.ts"
import { createConversationUI } from "../chat/ui.tsx"
import { createChat, type Chat } from "../chat/state.ts"
import { createAsked } from "../chat/attention/asked.ts"
import type { Roster } from "./answered.tsx"
import { createPageOwners } from "./page-owners.ts"
import type { PageSession } from "./Page.tsx"

export const createAgentReadings = (agents: Roster) => {
  const newChat = createNewChat()
  const page = createPageOwners<PageSession>()
  const previews = createPreviews()
  const reveals = new Set<string>()
  const shown = new Map<Chat, Set<() => boolean>>()
  const isShown = (chat: Chat) => [...(shown.get(chat) ?? [])].some(visible => visible())
  const memberships = new Map<string, Map<Chat, number>>()
  const owner = getOwner()
  const cache = new Map<string, { value: ReturnType<typeof createConversationUI>; dispose: () => void }>()
  const conversations = new Map<string, { value: Chat; dispose: () => void; leases: number }>()
  const awaitingEmpty = new Map<ReturnType<typeof createConversationUI>, () => void>()
  const joined = new Map<ReturnType<typeof createConversationUI>, number>()
  const [visits, setVisits] = createStore<Record<string, Conversing | undefined>>({})
  const waiting = new Set<() => void>()
  const needsSurfaces = new Set<{ element: HTMLElement; shown: () => boolean }>()
  let alive = true
  onCleanup(() => { alive = false; for (const entry of conversations.values()) entry.dispose(); conversations.clear(); for (const stop of [...awaitingEmpty.values()]) stop(); for (const stop of [...waiting]) stop(); for (const entry of cache.values()) entry.dispose(); cache.clear() })
  const ui = (to: PanelAddress) => {
    const key = JSON.stringify("session" in to ? [to.agent, to.session] : ["node", to.node])
    let entry = cache.get(key)
    if (entry === undefined) {
      entry = runWithOwner(owner, () => createRoot(dispose => ({ value: createConversationUI(previews), dispose })))!
      cache.set(key, entry)
    }
    return entry.value
  }
  const emptyUI = (value: ReturnType<typeof createConversationUI>) =>
    ![...value.messages.values()].some(([read]) => read().text !== "") &&
    ![...value.holding.values()].some(bin => bin.pending().length > 0 || bin.sending() > 0) &&
    value.drafts.empty() && value.pendingSends[0]() === 0 && value.starting[0]() === 0 &&
    value.folds.empty() && value.armed.armedNodes().length === 0 &&
    value.previewing.previewing() === null && value.refused[0]() === null
  const evictUI = (value: ReturnType<typeof createConversationUI>) => {
    for (const [key, entry] of cache) if (entry.value === value) {
      cache.delete(key)
      entry.dispose()
    }
  }
  const releaseUI = (value: ReturnType<typeof createConversationUI>) => {
    if (!alive) { evictUI(value); return }
    const count = (joined.get(value) ?? 1) - 1
    if (count > 0) { joined.set(value, count); return }
    joined.delete(value)
    // An address handover acquires its replacement within the same update.
    // Give that owner a chance to lease the same UI before considering eviction.
    queueMicrotask(() => {
    if (!alive || joined.has(value) || awaitingEmpty.has(value)) return
    if (emptyUI(value)) { evictUI(value); return }
    // A dispatched upload/send can finish after its last page leaves. Its UI
    // stays until that work clears, then releases without needing another visit.
    runWithOwner(owner, () => createRoot(dispose => {
      awaitingEmpty.set(value, dispose)
      onCleanup(() => awaitingEmpty.delete(value))
      createEffect(() => {
        if (!emptyUI(value)) return
        if (joined.has(value)) return
        dispose()
        evictUI(value)
      })
    }))
    })
  }
  const retainUI = (value: ReturnType<typeof createConversationUI>) => {
    awaitingEmpty.get(value)?.()
    joined.set(value, (joined.get(value) ?? 0) + 1)
    let held = true
    return () => { if (held) { held = false; releaseUI(value) } }
  }

  const [readings, setReadings] = createStore<Record<string, ReadonlySet<Chat> | undefined>>({})
  return {
    agents, ui, page, newChat, retainUI,
    conversation: (to: PanelAddress, expected: Conversing | null) => {
      const key = JSON.stringify("session" in to ? [to.agent, to.session] : ["node", to.node])
      let entry = conversations.get(key)
      if (entry === undefined) {
        entry = runWithOwner(owner, () => createRoot(dispose => {
          const value = createChat(to, { expected, ui: ui(to) })
          value.ui.question.bind(createAsked(value))
          return { value, dispose, leases: 0 }
        }))!
        conversations.set(key, entry)
      }
      const held = entry
      held.leases++
      onCleanup(() => {
        if (--held.leases !== 0 || conversations.get(key) !== held) return
        conversations.delete(key)
        held.dispose()
      })
      return held.value
    },
    needsSurface: (element: HTMLElement, shown: () => boolean) => {
      const row = { element, shown }
      needsSurfaces.add(row)
      onCleanup(() => needsSurfaces.delete(row))
    },
    focusNeeds: () => { [...needsSurfaces].find(row => row.shown() && row.element.isConnected)?.element.focus() },
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
      const live = [...(readings[node] ?? [])].filter(chat => isShown(chat))
      if (live.length === 0) reveals.add(node)
      else for (const chat of live) chat.ui.reveal[1](true)
    },
    at: (node: string) => readings[node],
    isShown,
    join: (node: string, chat: Chat, visible: () => boolean) => {
      const release = retainUI(chat.ui)
      const views = shown.get(chat) ?? new Set<() => boolean>()
      views.add(visible)
      shown.set(chat, views)
      const members = memberships.get(node) ?? new Map<Chat, number>()
      members.set(chat, (members.get(chat) ?? 0) + 1)
      memberships.set(node, members)
      createEffect(() => { if (visible() && reveals.delete(node)) chat.ui.reveal[1](true) })
      setReadings(node, new Set([...(readings[node] ?? []), chat]))
      onCleanup(() => {
        views.delete(visible)
        if (views.size === 0) shown.delete(chat)
        release()
        const remaining = members.get(chat)! - 1
        if (remaining > 0) { members.set(chat, remaining); return }
        members.delete(chat)
        if (members.size === 0) memberships.delete(node)
        const kept = new Set(readings[node])
        kept.delete(chat)
        setReadings(node, kept.size === 0 ? undefined : kept)
      })
    },
  }
}
const held = heldService<ReturnType<typeof createAgentReadings>>()
export const holdAgentReadings = held.hold
export const agentReadings = held.read
export const readAgent = (node: string, chat: Chat, shown: () => boolean = () => true) => held.read()?.join(node, chat, shown)
