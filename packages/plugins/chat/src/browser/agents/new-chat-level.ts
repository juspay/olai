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
  return item === null || item.kind !== "note" ? null : itemKey(item)
}

/** The items of the chats heard from most recently; activity ticking without
 *  reordering asks nothing new. */
const recentItems = (agents: Roster) => createMemo(
  () => byActivity(agents.rows()).slice(0, 32).map(row => row.id), undefined,
  { equals: (before, after) => before.length === after.length && before.every((id, index) => id === after[index]) },
)

/**
 * THE MESSAGE LEVEL FOR ONE CHOSEN ITEM: the engines that can start, the
 * first chosen, and one submit through the shared permit.
 *
 * TWO ROWS SPEND IT — *New chat*'s second level, which asks about whichever
 * item was chosen, and *Chat about this page*, which is the same level about
 * the note in front (`./AgentPalette.ts`). What differs between them is the
 * words in the empty box and what opens once the chat exists, so those are
 * the two things handed in: the copy that used to stand here twice is how one
 * of them came to skip the permit the other asks for.
 */
export const messageLevel = (
  owner: NewChatOwner,
  agents: Roster,
  item: AgentItem,
  asks: {
    readonly placeholder: string
    /** ...and what the press opens, once the chat is there: the key the start
     *  answered with. */
    readonly opened: (started: string) => void
  },
): PaletteValue => ({
  kind: "value",
  placeholder: asks.placeholder,
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
    const sent = await sendAbout({ item, engine: engine.id, text })
    if (sent.started === null) return { keepOpen: true, said: { tone: "alarm", text: sent.said ?? "No chat was started" } }
    if (signal.aborted) return {}
    asks.opened(sent.started)
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
  return { ...common, action: { kind: "level", level: messageLevel(owner, agents, itemOf(item.key), {
    placeholder: "Say something to start…",
    // ...AND THE CHAT'S OWN PAGE OPENS, with the first message already in it:
    // the person asked for a conversation, so the conversation is what they
    // are looking at.
    //
    // BY THE ITEM AND NOT BY THE ROSTER ROW, because the row may be one frame
    // behind the start that made it: a chat just started opens ALONE, because
    // a start writes no `chat-opens` switch at all (`../../server/binding.ts`
    // writes the session key and nothing else) and an absent switch reads as
    // alone, and every later press reads the row and obeys it (`./focus.ts`).
    opened: started => {
      const nav = navigation()
      if (nav === undefined) return
      const held = agents.at(started)
      if (held !== undefined) focusAgent(nav, held)
      else nav.go(chatRouteOf(itemOf(item.key)))
    },
  }) } }
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


/** THE ROW A REFUSED QUESTION LEAVES IN THE LEVEL, and the words on it.
 *
 *  A level that asked and was told nothing used to show an empty list, which
 *  reads exactly like *there is nothing here* — the one thing it is not. The
 *  server's own sentence goes on the row, and the press asks again: a
 *  person's gesture rather than a clock. The ONE thing that asks by itself is
 *  a question that went out on the settle after a reconnect, which goes out
 *  once more on the next frame of this plugin's roster and then waits too
 *  (`itemLevel`'s `reconnected` and `spent`). Every other refusal is this row
 *  until it is pressed, and a level nobody is looking at is gone.
 *
 *  Its id is deliberately NOT under `new-chat-`: the item rows are addressed
 *  by that prefix wherever they are read, and a refusal is not one of them. */
export const REFUSED_ROW = "chat-locations-refused"
const ASK_AGAIN = "Ask again"

/** The item level's rows, for one opening: Here is read once, as it opens;
 *  the query follows the typed text once typing pauses, and an answer to a
 *  superseded question, or one landing after the level is gone, changes
 *  nothing. */
const itemLevel = (owner: NewChatOwner, agents: Roster) => (scope: LevelScope): Accessor<ReadonlyArray<PaletteItem>> => {
  const here = untrack(hereItem)
  const recent = recentItems(agents)
  const filter = settled(scope.typed)
  const [answer, setAnswer] = createSignal<{
    readonly items: readonly ItemLocation[]
    /** The sentence the last question came back with, or nothing. */
    readonly refusal: string | null
  }>({ items: [], refusal: null })
  /** A person pressing the refusal's row. A counter rather than a flag: two
   *  presses are two questions, and the second must not be swallowed because
   *  the first left the signal where it already was. */
  const [pressed, setPressed] = createSignal(0)
  /** WHETHER THE QUESTION NOW ON THE WIRE WAS ASKED ON THE EDGE A NEW
   *  CONNECTION LEFT — the settle after this tab dialled — and whether its one
   *  automatic re-ask is still to come. Only such a question has one at all
   *  ({@link REFUSED_ROW} argues the rule); `spent` is true for every other,
   *  which is "no automatic re-ask". */
  let reconnected = false
  let spent = true
  /** Whether the ask about to go out IS that one automatic re-ask — so it
   *  cannot hand itself another one. */
  let retrying = false
  createEffect(() => {
    const keys = recent()
    const query = { filter: filter(), limit: ITEMS_LIMIT, keys: here === null ? keys : [here, ...keys] }
    pressed()
    let current = true
    onCleanup(() => { current = false })
    // NOTHING IS ASKED ACROSS A RECOMPOSE, and this is the whole of the fix
    // that used to be a timer. A plugin switched on or off makes the tab dial
    // a new wire, and every call in flight is interrupted at that moment
    // (`@olai/web`'s `client/run.ts`, which hands it back as `busy`) — so a
    // question asked in that window is a question nobody was ever going to
    // answer. This read is TRACKED (`../plugin-roster.ts`, over the app's
    // declared management door), so the effect runs again on both edges: it
    // stands down when the change begins — which also drops whatever the
    // interrupted call eventually says, because `current` is false by then —
    // and asks the question again the moment the composition has settled.
    // That is the EVENT the refusal came from, rather than a guess at how
    // long it lasts.
    if (pluginsChanging()) {
      reconnected = true
      return
    }
    // ...AND THE LIST FOLLOWS THE VAULT, which is the other half of asking at
    // the right moment. What `conversation.locations` answers is read off the
    // directory the serve holds, and that reading is remade — briefly empty —
    // when the serve recomposes. A question asked into that window is
    // answered truthfully with nothing, which draws an empty list: no
    // refusal, nothing to press, and a level that sits there saying *there is
    // nothing here* about a vault full of rows. This read is TRACKED, so the
    // directory settling is itself the event that asks again.
    servedDirectory()?.standing()
    // THE SETTLE AFTER A RECONNECT IS THE ONE EDGE WORTH A SECOND CHANCE: the
    // wire is new and the serve behind it may still be composing, which
    // refuses. That — and only that — arms the one re-ask below; the edge is
    // consumed here, so the question after it is an ordinary one again.
    spent = retrying || !reconnected
    retrying = false
    reconnected = false
    void runAsync(chatWire().procedures.conversation.locations(query)).then(result => {
      if (!current || scope.signal.aborted) return
      if (result._tag === "Success") setAnswer({ items: result.success.items, refusal: null })
      // ...AND A REFUSAL THAT IS NOT THAT IS SHOWN. Whatever the server said
      // is put on a row of its own, over the list this level last had: an
      // answer that did arrive is still the best thing to offer, and the
      // sentence above it says why there is nothing newer.
      else setAnswer(before => ({ items: before.items, refusal: result.failure.message }))
    })
  })
  // ...AND A QUESTION ASKED ON THAT EDGE, IF IT WAS REFUSED, GOES OUT ONCE
  // MORE — on the next frame of this plugin's own roster, and never again.
  //
  // The refusal has two causes and the dial's half is handled above. The
  // other is a serve still composing BEHIND a wire that is up —
  // `conversation.locations` reads the directory the chat server holds — and
  // nothing in this tab announces the moment it is ready. What does arrive is
  // the roster cell's next frame over that same wire, so a frame is the serve
  // saying it can answer questions again.
  //
  // EVERY OTHER REFUSAL WAITS FOR THE PERSON. Frames also come from ordinary
  // activity — a turn starting, an answer landing — and a level that asked
  // again on each of them turned a standing refusal into a question per tick,
  // which is a timer with another clock. So a frame is worth one question
  // only where a reconnect is what put the refusal there; everywhere else the
  // row says what the server said and *Ask again* is the whole of the retry.
  createEffect(() => {
    agents.rows()
    if (spent || untrack(() => answer().refusal) === null) return
    spent = true
    retrying = true
    setPressed(count => count + 1)
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

/** The palette row. Offered only while an engine can start. */
export const newChatRow = (owner: NewChatOwner, agents: Roster): PaletteItem => ({
  id: NEW_CHAT_ROW, label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
  action: { kind: "level", level: {
    kind: "group", placeholder: "Which node or note? Find one…", hint: "Type to find any node or note",
    children: itemLevel(owner, agents),
  } },
})
