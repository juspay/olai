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
import type { LevelScope, PaletteItem, PaletteValue } from "olai-plugin-navigation/contract"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { focusedNode } from "../references.ts"
import { pageReadings } from "../pages.ts"
import { byActivity } from "./activity-order.ts"
import { DEFAULT_LABEL, NODES_LIMIT, whereRows, type LocationNode, type WhereRow } from "./where.ts"
import type { Roster } from "./answered.tsx"
import type { createNewChat } from "./new-chat.ts"

export const NEW_CHAT_ROW = "new-chat"

/** The focused row, else the zoomed node, of the focused pane. */
const hereNow = (): string | null => {
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

/** What the last answer said the default container was — kept by the adapter's
 *  activation (`./AgentPalette.ts`) across openings, so a level can draw
 *  Default at once and let its own answer correct it. `undefined`: not yet
 *  asked in this activation. */
export interface DefaultMemory {
  readonly last: Accessor<string | null | undefined>
  readonly remember: (defaultParent: string | null) => void
}

/** The message level for one chosen place: the engines that can start, the
 *  first chosen, and one submit through the shared permit. */
const messageLevel = (owner: NewChatOwner, agents: Roster, parent: string | null): PaletteValue => ({
  kind: "value",
  placeholder: "Say something to start…",
  submitLabel: "Start chat",
  options: () => () => agents.engines().map(engine => ({ id: engine.id, label: engine.name })),
  validate: text => text.trim() === "" ? "Type a message first." : null,
  submit: async (text, engine, signal) => {
    if (engine === undefined) return { keepOpen: true, said: { tone: "alarm", text: "No agent is set up" } }
    const refusal = await owner.start(parent, engine.id, text, signal)
    return refusal === null ? {} : { keepOpen: true, said: { tone: "alarm", text: refusal } }
  },
})

const rowOf = (owner: NewChatOwner, agents: Roster) => (row: WhereRow): PaletteItem => row.node === undefined
  ? { id: "new-chat-default", label: DEFAULT_LABEL, hint: "default", section: row.section, search: DEFAULT_LABEL.toLowerCase(),
    taking: atOnce, action: { kind: "level", level: messageLevel(owner, agents, null) } }
  : { id: `new-chat-at-${row.node.id}`, label: row.node.title, place: nodePlace(row.node), section: row.section,
    search: row.node.title.toLowerCase(), taking: atOnce, action: { kind: "level", level: messageLevel(owner, agents, row.node.id) } }

/** How long typing must pause before the where level asks again. The first
 *  question, as the level opens, is asked at once. */
export const TYPING_PAUSE_MS = 120

/** The typed text, settled: the first value at once, later ones after a pause.
 *  The timer is the level's and stops with it. */
const settled = (typed: Accessor<string>): Accessor<string> => {
  const [value, setValue] = createSignal(untrack(typed))
  let first = true
  createEffect(() => {
    const now = typed()
    if (first) { first = false; return }
    const timer = setTimeout(() => setValue(now), TYPING_PAUSE_MS)
    onCleanup(() => clearTimeout(timer))
  })
  return value
}

/** The where level's rows, for one opening: Here is read once, as it opens;
 *  the query follows the typed text once typing pauses, and an answer to a
 *  superseded question, or one landing after the level is gone, changes
 *  nothing. Whether the vault's Inbox registry has an entry is the server's to
 *  say (`defaultParent`); until this opening's answer lands, Default is drawn
 *  from what the last opening was told, so a plain Enter at once can take it. */
const whereLevel = (owner: NewChatOwner, agents: Roster, memory: DefaultMemory) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereNow)
  const recent = recentAgents(agents)
  const filter = settled(scope.typed)
  const [answer, setAnswer] = createSignal<{ readonly nodes: readonly LocationNode[]; readonly defaultParent: string | null }>(
    { nodes: [], defaultParent: untrack(memory.last) ?? null })
  createEffect(() => {
    const ids = recent()
    const query = { filter: filter(), limit: NODES_LIMIT, ids: here === null ? ids : [here, ...ids], parents: ids }
    let current = true
    onCleanup(() => { current = false })
    void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
      if (current && !scope.signal.aborted && result._tag === "Success") {
        setAnswer(result.success)
        memory.remember(result.success.defaultParent)
      }
    })
  })
  return createMemo(() => whereRows({
    defaultOffered: answer().defaultParent !== null, defaultParent: answer().defaultParent, here, recent: recent(),
    nodes: answer().nodes, typed: scope.typed(),
  }).map(rowOf(owner, agents)))
}

/** The palette row. Offered only while an engine can start. */
export const newChatRow = (owner: NewChatOwner, agents: Roster, memory: DefaultMemory): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Where? Find a node…", hint: "Type to find any node",
    children: whereLevel(owner, agents, memory),
  } },
})
