import { createStore } from "solid-js/store"
import { createNewChat } from "./new-chat.ts"
import { createPreviews } from "../chat/previews.ts"
import { createEffect, createMemo, createSignal, on, createRoot, getOwner, runWithOwner, onCleanup } from "solid-js"
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
  type View = { node: () => string; chat: () => Chat | null; shown: () => boolean }
  const [views, setViews] = createSignal<readonly View[]>([])
  const isShown = (chat: Chat) => views().some(view => view.chat() === chat && view.shown())
  const owner = getOwner()
  const cache = new Map<string, { to: PanelAddress; value: ReturnType<typeof createConversationUI>; dispose: () => void }>()
  const conversations = new Map<string, { value: Chat; dispose: () => void; leases: number }>()
  const awaitingEmpty = new Map<ReturnType<typeof createConversationUI>, () => void>()
  const joined = new Map<ReturnType<typeof createConversationUI>, number>()
  const [visits, setVisits] = createStore<Record<string, Conversing | undefined>>({})
  const [resumed, setResumed] = createStore<Record<string, Conversing | undefined>>({})
  const waiting = new Set<() => void>()
  const needsSurfaces = new Set<{ element: HTMLElement; shown: () => boolean }>()
  let alive = true
  onCleanup(() => { alive = false; for (const entry of conversations.values()) entry.dispose(); conversations.clear(); for (const stop of [...awaitingEmpty.values()]) stop(); for (const stop of [...waiting]) stop(); for (const entry of cache.values()) entry.dispose(); cache.clear() })
  const ui = (to: PanelAddress) => {
    const key = JSON.stringify("session" in to ? [to.agent, to.session] : ["node", to.node])
    let entry = cache.get(key)
    if (entry === undefined) {
      entry = runWithOwner(owner, () => createRoot(dispose => ({ to, value: createConversationUI(previews), dispose })))!
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
  const belongs = (value: ReturnType<typeof createConversationUI>) => {
    const entry = [...cache.values()].find(entry => entry.value === value)
    if (!entry) return false
    const to = entry.to
    if ("node" in to) return agents.at(to.node) !== undefined
    if (agents.rows().some(row => row.engine === to.agent && row.session === to.session)) return true
    const listed = agents.chats()
    // A missing or refused listing is not evidence that the session is gone.
    return listed === null || listed.unreachable.some(row => row.agent === to.agent)
      || listed.sessions.some(row => row.agent === to.agent && row.id === to.session)
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
    if (emptyUI(value) || !belongs(value)) { evictUI(value); return }
    // A dispatched upload/send can finish after its last page leaves. Its UI
    // stays until that work clears, then releases without needing another visit.
    runWithOwner(owner, () => createRoot(dispose => {
      awaitingEmpty.set(value, dispose)
      onCleanup(() => awaitingEmpty.delete(value))
      createEffect(() => {
        if (!emptyUI(value) && belongs(value)) return
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

  const readings = createMemo(() => {
    const result = new Map<string, Set<Chat>>()
    for (const view of views()) {
      const chat = view.chat()
      if (!chat) continue
      const node = view.node()
      const members = result.get(node) ?? new Set<Chat>()
      members.add(chat)
      result.set(node, members)
    }
    return result
  })
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
    visit: (node: string, to?: Conversing) => { setVisits(node, to); setResumed(node, undefined) },
    resume: (node: string, to: Conversing) => { setVisits(node, undefined); setResumed(node, to) },
    resuming: (node: string) => resumed[node],
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
          const chat = [...(readings().get(node) ?? [])].find(chat => chat.ui === ui(to))
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
      const live = [...(readings().get(node) ?? [])].filter(chat => isShown(chat))
      if (live.length === 0) reveals.add(node)
      else for (const chat of live) chat.ui.reveal[1](true)
    },
    at: (node: string) => readings().get(node),
    isShown,
    join: (node: () => string, chat: () => Chat | null, visible: () => boolean) => {
      // The view registers once at mount. Its changing conversation is a
      // derivation, not a memo publishing into another store.
      const view = { node, chat, shown: visible }
      setViews(all => [...all, view])
      onCleanup(() => setViews(all => all.filter(one => one !== view)))
      createEffect(on(chat, current => {
        if (current) onCleanup(retainUI(current.ui))
      }))
      createEffect(() => {
        const current = chat()
        if (current && visible() && reveals.delete(node())) current.ui.reveal[1](true)
      })
    },
  }
}
const held = heldService<ReturnType<typeof createAgentReadings>>()
export const holdAgentReadings = held.hold
export const agentReadings = held.read
export const readAgent = (node: string, chat: Chat, shown: () => boolean = () => true) => held.read()?.join(() => node, () => chat, shown)
