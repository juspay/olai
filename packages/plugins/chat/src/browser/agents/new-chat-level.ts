import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { type AgentItem, itemKey, itemOf } from "@olai/format"
import type { LevelScope, PaletteItem, PaletteOption, PaletteValue } from "olai-plugin-navigation/contract"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { servedDirectory } from "../vault.ts"
import { fileMark } from "../kinds.ts"
import { pluginsChanging } from "../plugin-roster.ts"
import { byActivity } from "./activity-order.ts"
import { sendAbout } from "./send-about.ts"
import { focusAgent } from "./focus.ts"
import { itemHere } from "./here.ts"
import { chatRouteOf } from "./route.ts"
import { talking } from "./roster.ts"
import { ITEMS_LIMIT, itemRows, type ItemRow } from "./where.ts"
import type { ItemLocation } from "olai-plugin-chat/wire"
import type { Roster } from "./answered.tsx"
import type { NewChatOwner } from "./new-chat.ts"

export const NEW_CHAT_ROW = "new-chat"

export const hereNow = (): string | null => {
  const nav = navigation()
  const pane = nav?.panes()[nav.focusIndex()]
  const page = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
  return focusedNode() ?? (page?.kind === "node" && page.zoomed.kind === "node" ? page.zoomed.shows.node.id : null)
}

export const hereItem = (): string | null => {
  const node = hereNow()
  if (node !== null) return node
  const nav = navigation()
  const pane = nav?.panes()[nav.focusIndex()]
  if (pane === undefined) return null
  const item = itemHere(servedDirectory()?.claims(), pane.route())
  return item === null || item.kind !== "note" ? null : itemKey(item)
}

const recentItems = (agents: Roster) => createMemo(
  () => byActivity(agents.rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)

export const messageLevel = (
  owner: NewChatOwner,
  agents: Roster,
  item: AgentItem,
  asks: {
    readonly placeholder: string
    readonly opened: (started: string) => void
  },
): PaletteValue => ({
  kind: "value",
  placeholder: asks.placeholder,
  submitLabel: "Start chat",
  options: () => createMemo<ReadonlyArray<PaletteOption>>(previous => agents.engines().map(engine =>
    previous.find(option => option.id === engine.id && option.label === engine.name) ?? { id: engine.id, label: engine.name }), []),
  validate: text => text.trim() === "" ? "Type a message first." : null,
  submit: async (text, engine, signal) => {
    if (engine === undefined) return { keepOpen: true, said: { tone: "alarm", text: "No agent is set up" } }
    if (owner.pending()) return { keepOpen: true, said: { tone: "alarm", text: "A new chat is already starting" } }
    const sent = await sendAbout({ item, engine: engine.id, text })
    if (sent.started === null) return { keepOpen: true, said: { tone: "alarm", text: sent.said ?? "No chat was started" } }
    if (signal.aborted) return {}
    asks.opened(sent.started)
    return {}
  },
})

const drawn = (row: ItemRow, chatting: boolean): string =>
  JSON.stringify([row.section, row.item.key, row.item.title, row.item.file, row.item.path, chatting])

const HAS_A_CHAT = "has a chat"

const rowOf = (owner: NewChatOwner, agents: Roster) => (row: ItemRow): PaletteItem => {
  const item = row.item
  const existing = agents.at(item.key)
  const mark = item.kind === "note" ? fileMark(item.file) : undefined
  const place = item.kind === "note" ? item.file : nodePlace({ file: item.file, path: item.path })
  const common = {
    id: `new-chat-at-${item.key}`, label: item.title, place, section: row.section,
    ...(mark === undefined ? {} : { mark }),
    search: item.title.toLowerCase(), taking: atOnce,
  }
  if (talking(existing)) {
    return { ...common, hint: HAS_A_CHAT, action: { kind: "run", run: async () => {
      const nav = navigation()
      const held = agents.at(item.key)
      if (nav === undefined || held === undefined) {
        return { keepOpen: true, said: { tone: "alarm" as const, text: "Can't open this right now" } }
      }
      focusAgent(nav, held)
      return {}
    } } }
  }
  return { ...common, action: { kind: "level", level: messageLevel(owner, agents, itemOf(item.key), {
    placeholder: "Say something to start…",
    opened: started => {
      const nav = navigation()
      if (nav === undefined) return
      const held = agents.at(started)
      if (held !== undefined) focusAgent(nav, held)
      else nav.go(chatRouteOf(itemOf(item.key)))
    },
  }) } }
}

export const TYPING_PAUSE_MS = 120

export const settled = (typed: Accessor<string>): Accessor<string> => {
  const [value, setValue] = createSignal(untrack(typed))
  createEffect(() => {
    const now = typed()
    if (now === untrack(value)) return
    const timer = setTimeout(() => setValue(now), TYPING_PAUSE_MS)
    onCleanup(() => clearTimeout(timer))
  })
  return value
}


export const REFUSED_ROW = "chat-locations-refused"
const ASK_AGAIN = "Ask again"

const itemLevel = (owner: NewChatOwner, agents: Roster) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereItem)
  const recent = recentItems(agents)
  const filter = settled(scope.typed)
  const [answer, setAnswer] = createSignal<{
    readonly items: readonly ItemLocation[]
    readonly refusal: string | null
  }>({ items: [], refusal: null })
  const [pressed, setPressed] = createSignal(0)
  let reconnected = false
  let spent = true
  let retrying = false
  createEffect(() => {
    const keys = recent()
    const query = { filter: filter(), limit: ITEMS_LIMIT, keys: here === null ? keys : [here, ...keys] }
    pressed()
    let current = true
    onCleanup(() => { current = false })
    if (pluginsChanging()) {
      reconnected = true
      return
    }
    servedDirectory()?.standing()
    spent = retrying || !reconnected
    retrying = false
    reconnected = false
    void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
      if (!current || scope.signal.aborted) return
      if (result._tag === "Success") setAnswer({ items: result.success.items, refusal: null })
      else setAnswer(before => ({ items: before.items, refusal: result.failure.message }))
    })
  })
  createEffect(() => {
    agents.rows()
    if (spent || untrack(() => answer().refusal) === null) return
    spent = true
    retrying = true
    setPressed(count => count + 1)
  })

  const toItem = rowOf(owner, agents)
  const entries = createMemo<ReadonlyArray<{ readonly key: string; readonly item: PaletteItem }>>(previous => itemRows({
    here, recent: recent(), items: answer().items, typed: scope.typed(),
  }).map(row => {
    const key = drawn(row, talking(agents.at(row.item.key)))
    return previous.find(entry => entry.key === key) ?? { key, item: toItem(row) }
  }), [])
  const refused = createMemo((): ReadonlyArray<PaletteItem> => {
    const said = answer().refusal
    return said === null ? [] : [{
      id: REFUSED_ROW, label: said, hint: ASK_AGAIN, search: "", taking: atOnce,
      action: { kind: "run", run: async () => {
        setPressed(count => count + 1)
        return { keepOpen: true }
      } },
    }]
  })
  return createMemo(() => [...refused(), ...entries().map(entry => entry.item)])
}

export const newChatRow = (owner: NewChatOwner, agents: Roster): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Which node or note? Find one…", hint: "Type to find any node or note",
    children: itemLevel(owner, agents),
  } },
})
