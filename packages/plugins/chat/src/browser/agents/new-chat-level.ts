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
import { inboxIn } from "@olai/format"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import type { LevelScope, PaletteItem, PaletteValue } from "olai-plugin-navigation/contract"
import { nodePlace } from "olai-plugin-search/ui/place.ts"
import { chatWire } from "../wire.ts"
import { servedDirectory } from "../vault.ts"
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
  const page = nav === undefined ? undefined : pageReadings()?.at(nav.workspace().focus)?.shows
  return focusedNode() ?? (page?.kind === "node" && page.zoomed.kind === "node" ? page.zoomed.shows.node.id : null)
}

/** The vault's Inbox registry names a served outline, so the default can be
 *  minted. Read off the claims, as capture's own door is, without naming it. */
const inboxOffered = (): boolean => {
  const served = servedDirectory()
  const claims = served?.claims()
  return served !== undefined && claims !== undefined && inboxIn(claims, served.paths()) !== undefined
}

/** Recent agent ids; activity ticking without reordering asks nothing new. */
const recentAgents = (agents: Roster) => createMemo(
  () => byActivity(agents.rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)

type NewChatOwner = ReturnType<typeof createNewChat>

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

/** The where level's rows, for one opening: Here is read once, as it opens;
 *  the query follows the typed text, and an answer to a superseded question,
 *  or one landing after the level is gone, changes nothing. */
const whereLevel = (owner: NewChatOwner, agents: Roster) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereNow)
  const recent = recentAgents(agents)
  const [answer, setAnswer] = createSignal<{ readonly nodes: readonly LocationNode[]; readonly defaultParent: string | null }>(
    { nodes: [], defaultParent: null })
  createEffect(() => {
    const ids = recent()
    const query = { filter: scope.typed(), limit: NODES_LIMIT, ids: here === null ? ids : [here, ...ids], parents: ids }
    let current = true
    onCleanup(() => { current = false })
    void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
      if (current && !scope.signal.aborted && result._tag === "Success") setAnswer(result.success)
    })
  })
  return createMemo(() => whereRows({
    defaultOffered: inboxOffered(), defaultParent: answer().defaultParent, here, recent: recent(),
    nodes: answer().nodes, typed: scope.typed(),
  }).map(rowOf(owner, agents)))
}

/** The palette row. Offered only while an engine can start. */
export const newChatRow = (owner: NewChatOwner, agents: Roster): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Where? Find a node…", hint: "Type to find any node",
    children: whereLevel(owner, agents),
  } },
})
