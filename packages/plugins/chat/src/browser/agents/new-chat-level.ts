/**
 * NEW CHAT, AS TWO PALETTE LEVELS — where, then what to say.
 *
 * The row is contributed through chat's `paletteAdapters` adapter
 * (`./AgentPalette.ts`) and withdrawn with it; navigation owns the open path
 * and each level's scope. What chat runs inside a level — the location query,
 * its memos — lives in the {@link LevelScope} the palette hands the level's
 * function, and goes with it. The one creation in flight is NOT the level's: it
 * is this activation's {@link createNewChat} permit, which every submit shares.
 */
import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import type { LevelScope, PaletteItem, PaletteOption, PaletteValue } from "olai-plugin-navigation/contract"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { byActivity } from "./activity-order.ts"
import { NODES_LIMIT, whereRows, type LocationNode, type WhereRow } from "./where.ts"
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

/** Recent agent ids; activity ticking without reordering asks nothing new. */
const recentAgents = (agents: Roster) => createMemo(
  () => byActivity(agents.rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)

type NewChatOwner = ReturnType<typeof createNewChat>

/** The message level for one chosen place: the engines that can start, the
 *  first chosen, and one submit through the shared permit. */
const messageLevel = (owner: NewChatOwner, agents: Roster, parent: string): PaletteValue => ({
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
    const refusal = await owner.start(parent, engine.id, text, signal)
    return refusal === null ? {} : { keepOpen: true, said: { tone: "alarm", text: refusal } }
  },
})

/** What a place row draws; a row whose drawing is unchanged keeps its object. */
const drawn = (row: WhereRow): string =>
  JSON.stringify([row.section, row.node.id, row.node.title, row.node.file, row.node.path])

const rowOf = (owner: NewChatOwner, agents: Roster) => (row: WhereRow): PaletteItem =>
  ({ id: `new-chat-at-${row.node.id}`, label: row.node.title, place: nodePlace(row.node), section: row.section,
    search: row.node.title.toLowerCase(), taking: atOnce, action: { kind: "level", level: messageLevel(owner, agents, row.node.id) } })

/** How long typing must pause before the where level asks again. The first
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

/** The where level's rows, for one opening: Here is read once, as it opens;
 *  the query follows the typed text once typing pauses, and an answer to a
 *  superseded question, or one landing after the level is gone, changes
 *  nothing. */
const whereLevel = (owner: NewChatOwner, agents: Roster) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereNow)
  const recent = recentAgents(agents)
  const filter = settled(scope.typed)
  const [answer, setAnswer] = createSignal<{ readonly nodes: readonly LocationNode[] }>({ nodes: [] })
  createEffect(() => {
    const ids = recent()
    const query = { filter: filter(), limit: NODES_LIMIT, ids: here === null ? ids : [here, ...ids], parents: ids }
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
  // typing filters the list and answers arrive.
  const toItem = rowOf(owner, agents)
  const entries = createMemo<ReadonlyArray<{ readonly key: string; readonly item: PaletteItem }>>(previous => whereRows({
    here, recent: recent(), nodes: answer().nodes, typed: scope.typed(),
  }).map(row => {
    const key = drawn(row)
    return previous.find(entry => entry.key === key) ?? { key, item: toItem(row) }
  }), [])
  return createMemo(() => entries().map(entry => entry.item))
}

/** The palette row. Offered only while an engine can start. */
export const newChatRow = (owner: NewChatOwner, agents: Roster): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Where? Find a node…", hint: "Type to find any node",
    children: whereLevel(owner, agents),
  } },
})
