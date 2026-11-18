/**
 * NEW CHAT, AS TWO PALETTE LEVELS — which node or note, then what to say.
 *
 * The row is contributed through chat's `paletteAdapters` adapter
 * (`./AgentPalette.ts`) and withdrawn with it; navigation owns the open path
 * and each level's scope. What chat runs inside a level — the location query,
 * its memos — lives in the {@link LevelScope} the palette hands the level's
 * function, and goes with it. The one creation in flight is NOT the level's:
 * it is this activation's {@link createNewChat} permit, which every submit
 * shares.
 *
 * NOTHING IS MINTED. The first level is a list of THINGS — the item in front
 * of the reader, the chats they were last in, and any node or note once
 * something is typed — and the chat that is started belongs to whichever of
 * them they choose. An item that already has one is drawn as such and opens
 * it instead of starting a second: the refusal for that exists on the server
 * (`../../server/new-chat.ts`), and a list that can see the roster has no
 * business walking a person into it.
 */
import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { itemOf } from "@olai/format"
import type { LevelScope, PaletteItem, PaletteOption, PaletteValue } from "olai-plugin-navigation/contract"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { servedDirectory } from "../vault.ts"
import { fileMark } from "../kinds.ts"
import { byActivity } from "./activity-order.ts"
import { sendAbout } from "./send-about.ts"
import { focusAgent } from "./focus.ts"
import { itemHere } from "./here.ts"
import { chatRouteOf } from "./route.ts"
import { talking } from "./roster.ts"
import { ITEMS_LIMIT, itemRows, type ItemRow, type LocationItem } from "./where.ts"
import type { Roster } from "./answered.tsx"
import type { createNewChat } from "./new-chat.ts"

export const NEW_CHAT_ROW = "new-chat"

/** The focused row, else the zoomed node, of the focused pane. */
export const hereNow = (): string | null => {
  const nav = navigation()
  const pane = nav?.panes()[nav.focusIndex()]
  const page = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
  return focusedNode() ?? (page?.kind === "node" && page.zoomed.kind === "node" ? page.zoomed.shows.node.id : null)
}

/** ...and the ITEM a new chat would be about from where the reader stands: the
 *  row or node above, else the note the focused pane is showing. */
export const hereItem = (): string | null => {
  const node = hereNow()
  if (node !== null) return node
  const nav = navigation()
  const pane = nav?.panes()[nav.focusIndex()]
  if (pane === undefined) return null
  const item = itemHere(servedDirectory()?.claims(), pane.route())
  return item === null || item.kind !== "note" ? null : `/${item.path}`
}

/** The items of the chats heard from most recently; activity ticking without
 *  reordering asks nothing new. */
const recentItems = (agents: Roster) => createMemo(
  () => byActivity(agents.rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)

type NewChatOwner = ReturnType<typeof createNewChat>

/** The message level for one chosen item: the engines that can start, the
 *  first chosen, and one submit through the shared permit. */
const messageLevel = (owner: NewChatOwner, agents: Roster, item: LocationItem): PaletteValue => ({
  kind: "value",
  placeholder: "Say something to start…",
  submitLabel: "Start chat",
  // One memo per opening, in the level's scope: the radio group is drawn by
  // object, so an option keeps its object while its engine keeps its name.
  options: () => createMemo<ReadonlyArray<PaletteOption>>(previous => agents.engines().map(engine =>
    previous.find(option => option.id === engine.id && option.label === engine.name) ?? { id: engine.id, label: engine.name }), []),
  validate: text => text.trim() === "" ? "Type a message first." : null,
  submit: async (text, engine, signal) => {
    if (engine === undefined) return { keepOpen: true, said: { tone: "alarm", text: "No agent is set up" } }
    if (owner.pending()) return { keepOpen: true, said: { tone: "alarm", text: "A new chat is already starting" } }
    // ONE PRESS OF THE DOOR (`./send-about.ts`'s `sendAbout`): the server starts
    // the chat on this item and delivers the words, so a refusal keeps them
    // in this box with the sentence beside them and opens nothing.
    const sent = await sendAbout({ item: itemOf(item.key), engine: engine.id, text })
    if (sent.started === null) return { keepOpen: true, said: { tone: "alarm", text: sent.said ?? "No chat was started" } }
    if (signal.aborted) return {}
    // ...AND THE CHAT'S OWN PAGE OPENS, with the first message already in it:
    // the person asked for a conversation, so the conversation is what they
    // are looking at.
    //
    // BY THE ITEM AND NOT BY THE ROSTER ROW, because the row may be one frame
    // behind the start that made it: a chat just started opens ALONE, because
    // a start writes no `chat-opens` switch at all (`../../server/binding.ts`
    // writes the session key and nothing else) and an absent switch reads as
    // alone, and every later press reads the row and obeys it (`./focus.ts`).
    const nav = navigation()
    if (nav === undefined) return {}
    const row = agents.at(sent.started)
    if (row !== undefined) focusAgent(nav, row)
    else nav.go(chatRouteOf(itemOf(item.key)))
    return {}
  },
})

/** What an item row draws; a row whose drawing is unchanged keeps its object. */
const drawn = (row: ItemRow, chatting: boolean): string =>
  JSON.stringify([row.section, row.item.key, row.item.title, row.item.file, row.item.path, chatting])

/** WHAT A CHAT ALREADY THERE SAYS, on the row of the item that has it: the
 *  press opens that conversation rather than asking for a message nothing
 *  would accept. */
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
  return { ...common, action: { kind: "level", level: messageLevel(owner, agents, item) } }
}

/** How long typing must pause before the item level asks again. The first
 *  question, as the level opens, is asked at once. */
export const TYPING_PAUSE_MS = 120

/** The typed text, settled: the value the level opened with is the question it
 *  asks at once, and later ones wait for typing to pause. The timer is the
 *  level's and stops with it.
 *
 *  JUDGED BY THE VALUE and never by which run this is. Counting runs swallowed
 *  a change that landed before the first effect ran — words typed into the box
 *  in the same breath as the level opening, which under load is an ordinary
 *  thing — and the level then asked its question about the empty box forever,
 *  since nothing was going to type again. */
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


/** How long the level waits before asking again when a question comes back
 *  with no answer, and how many times it tries. A plugin arriving or leaving
 *  recomposes this serve's surface, and a call made across that moment is
 *  refused: a level that asked once would then stay EMPTY for as long as
 *  somebody looked at it, because nothing is ever going to type again. */
export const RETRY_PAUSE_MS = 150
const RETRIES = 10

/** The item level's rows, for one opening: Here is read once, as it opens;
 *  the query follows the typed text once typing pauses, and an answer to a
 *  superseded question, or one landing after the level is gone, changes
 *  nothing. */
const itemLevel = (owner: NewChatOwner, agents: Roster) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereItem)
  const recent = recentItems(agents)
  const filter = settled(scope.typed)
  const [answer, setAnswer] = createSignal<{ readonly items: readonly LocationItem[] }>({ items: [] })
  createEffect(() => {
    const keys = recent()
    const query = { filter: filter(), limit: ITEMS_LIMIT, keys: here === null ? keys : [here, ...keys] }
    let current = true
    let timer: ReturnType<typeof setTimeout> | undefined
    onCleanup(() => { current = false; clearTimeout(timer) })
    const ask = (left: number): void => {
      void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
        if (!current || scope.signal.aborted) return
        if (result._tag === "Success") setAnswer(result.success)
        else if (left > 0) timer = setTimeout(() => ask(left - 1), RETRY_PAUSE_MS)
      })
    }
    ask(RETRIES)
  })

  // The palette keys rows by id and hands each row its item; reusing the item
  // of a row whose drawing is unchanged keeps that row's bindings asleep while
  // typing filters the list and answers arrive. Whether the item already has a
  // chat is part of that drawing: it decides the hint AND what the press does.
  const toItem = rowOf(owner, agents)
  const entries = createMemo<ReadonlyArray<{ readonly key: string; readonly item: PaletteItem }>>(previous => itemRows({
    here, recent: recent(), items: answer().items, typed: scope.typed(),
  }).map(row => {
    const key = drawn(row, talking(agents.at(row.item.key)))
    return previous.find(entry => entry.key === key) ?? { key, item: toItem(row) }
  }), [])
  return createMemo(() => entries().map(entry => entry.item))
}

/** The palette row. Offered only while an engine can start. */
export const newChatRow = (owner: NewChatOwner, agents: Roster): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Which node or note? Find one…", hint: "Type to find any node or note",
    children: itemLevel(owner, agents),
  } },
})
