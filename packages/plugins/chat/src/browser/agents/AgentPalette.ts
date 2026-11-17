import { createMemo, createSignal } from "solid-js"
import { Result } from "effect"
import type { PaletteAdapter, PaletteItem, PaletteOption } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { agentReadings } from "./reading.ts"
import { focusAgent } from "./focus.ts"
import { byActivity } from "./activity-order.ts"
import { hereNow, newChatRow } from "./new-chat-level.ts"
import { agentAboveOf } from "./above.ts"
import { LOOK } from "./roster.ts"
import { chatVerbs } from "../verbs.tsx"
import type { RowVerb } from "olai-plugin-outlines/slots"
import type { Roster } from "./answered.tsx"
import { placeOfRoute } from "./place.ts"
import { dock } from "../dock.ts"
import { sendAbout } from "./Door.tsx"
import { talking } from "./roster.ts"

/** The palette row that starts a chat about the page in front. */
export const ABOUT_ROW = "chat-about-page"

/**
 * EVERY CHAT VERB BUT THE ONE THAT UNBINDS.
 *
 * ⌘K is reached from anywhere and acts on whatever chat happens to be on
 * screen, with no row under the cursor to say which one and no `•••` panel
 * standing open to say it twice. *Close the agent* takes a node's chat away
 * from it; a verb that far-reaching asks to be pressed where a person can see
 * what they are pressing it on, which is the two menus.
 */
const inPalette = (verb: RowVerb): boolean => verb.id !== "close-agent"

/** Listing reads the activation's roster; only selection opens a conversation. */
export const createAgentPalette = (agents: Roster): PaletteAdapter => {
  const creation = agentReadings()?.newChat
  // The last default container New chat was told of, for this activation.
  const [last, remember] = createSignal<string | null>()
  const memory = { last, remember: (value: string | null) => { remember(value) } }
  // One New chat row for the activation: listing again (a roster tick) hands
  // the palette the same object, so its open path and drawing stay put.
  const newChat = creation === undefined ? undefined : newChatRow(creation, agents, memory)
  /**
   * THE CHAT ON SCREEN, AS ⌘K ROWS — the opt-in, and then the menus' own
   * verbs (`../verbs.tsx`'s `chatVerbs`) wearing this list's dressing.
   *
   * WHICH CONVERSATION IS NOT A QUESTION THIS LIST CAN ASK: the `•••` hangs off
   * a row and knows its node, and a palette is opened from anywhere and knows
   * nothing. What it CAN see is what the tab is showing — `agentReadings()`'s
   * `shownChat`, the same reading the attention circuit asks before it decides a
   * question is being watched — so the rows are offered exactly while a node
   * agent's conversation is on screen, and they name that node. With none shown
   * there are no rows at all, which is the rule the op rows already keep: a
   * palette acts on the page, never on a guess.
   *
   * THE OPT-IN IS THE ONE ROW THIS LIST OWNS, because its LABEL is its
   * indicator and the menus draw it differently: nothing is tidied on its own
   * until somebody says so, and the row says which way the press will go
   * (`sleeps`, joined onto the roster row). Which of the rest are offered is
   * `chatVerbs`'s answer and not a second rule written here.
   *
   * A REFUSAL IS THE PALETTE'S OWN LINE, in the palette's own mood
   * (`{@link PaletteRunResult}`), and the sentence is the server's: a pass is
   * already running, nothing is bound there, or `sleep` is off in this
   * directory's settings. Nothing is drawn differently for it — a row that
   * vanished when it could not run would be a row whose absence has no
   * explanation.
   */
  const sleeping = (): ReadonlyArray<PaletteItem> => {
    const held = agentReadings()
    if (held === undefined) return []
    const shown = agents.rows().find((row) => held.shownChat(row.id) !== undefined)
    if (shown === undefined) return []
    return [
      {
        id: "sleep-when-idle",
        label: shown.sleeps ? "Stop sleeping when idle" : "Sleep when idle",
        place: `on “${agents.named(shown).name}”`,
        // THE WORDS THAT ARE ON SCREEN, both of them: the label flips with the
        // mark, and a search that spelled only the "on" one left a person who
        // typed what they could see — "stop" — with no row at all.
        search: `${shown.sleeps ? "stop sleeping when idle" : "sleep when idle"} ${agents.named(shown).name}`.toLowerCase(),
        taking: atOnce,
        action: { kind: "run", run: async () => {
          const outcome = await runAsync(
            chatWire().procedures.conversation.setSleeping({ node: shown.id, on: !shown.sleeps }),
          )
          if (Result.isFailure(outcome)) {
            return { keepOpen: true, said: { tone: "alarm" as const, text: outcome.failure.message } }
          }
          return {}
        } },
      },
      /* ...AND THE REST ARE THE MENUS' OWN VERBS, drawn as palette rows rather
         than written out again. The label, the id and what the press DOES are
         one idea with three faces (`../verbs.tsx`'s `chatVerbs`), and the copy
         that used to live here is how *Sleep now* came to be spelled in three
         places and renamed in three places. What is the palette's is the
         dressing: where the row says it acts, what a person can type to find
         it, and that a refusal is a line rather than a failed call. */
      ...chatVerbs(shown).filter(inPalette).map((verb): PaletteItem => ({
        id: verb.id, label: verb.label, place: `on “${agents.named(shown).name}”`,
        search: `${verb.label} ${agents.named(shown).name}`.toLowerCase(), taking: atOnce,
        action: { kind: "run", run: async () => {
          const said = await verb.run(shown.id)
          return typeof said === "string"
            ? { keepOpen: true, said: { tone: "alarm" as const, text: said } }
            : {}
        } },
      })),
    ]
  }
  /** THE ROW ABOVE the focused row (or the zoomed node): the pill's door, for
   *  the keyboard. Resolved when the list is asked, so it appears and leaves
   *  with the roster; its press resolves again, so a roster that moved while
   *  the palette was open cannot open the wrong conversation. */
  const above = (): ReadonlyArray<PaletteItem> => {
    const here = hereNow()
    const row = here === null ? undefined : agentAboveOf(here, agents)
    if (row === undefined) return []
    return [{
      id: "open-agent-above", label: "Open the agent above", place: `on “${agents.named(row).name}”`,
      search: `open the agent above ${agents.named(row).name}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: async () => {
        const nav = navigation()
        if (nav === undefined) return { keepOpen: true, said: { tone: "alarm" as const, text: "Can't open this right now" } }
        const now = hereNow()
        const target = now === null ? undefined : agentAboveOf(now, agents)
        if (target !== undefined) focusAgent(nav, agents, target)
        return {}
      } },
    }]
  }
  /**
   * **CHAT ABOUT THIS PAGE** — the door, from ⌘K: offered while the page in
   * front placed a seat, has no chat at its place, and an agent can start, and
   * one message level away from a chat about it (`./Door.tsx` is the same door
   * under the page). Kept as one object per page, so a roster tick under an
   * open level hands the palette the row it already has.
   *
   * IT ALSO STANDS WHILE ITS OWN SEND IS OUT, which is not a second rule but
   * the first one's cost. A level's lifetime is its row's: the palette aborts
   * a step whose row its adapter no longer lists, and an aborted step drops
   * the answer that would have closed the palette
   * (`olai-plugin-navigation`'s `level-owner.ts`). The chat this level is
   * starting is exactly what takes the row away, so without this the one
   * gesture that works leaves the overlay standing over the page it just
   * started a conversation about. The flag goes down when the step does —
   * `submit` is handed that step's own `signal`.
   */
  const [sending, setSending] = createSignal(false)
  let aboutHeld: { readonly key: string; readonly item: PaletteItem } | undefined
  const about = (): ReadonlyArray<PaletteItem> => {
    const nav = navigation()
    const held = agentReadings()
    if (nav === undefined || held === undefined || creation === undefined || agents.engines().length === 0) return []
    const pane = nav.panes()[nav.focusIndex()]
    const here = pane === undefined ? undefined : held.seatIn(pane.id)
    if (here === undefined) return []
    if (talking(agents.chatAt(placeOfRoute(nav.routes, here.place))) && !sending()) return []
    const address = nav.routes.href(here.place)
    const name = here.name
    const key = JSON.stringify([address, name])
    if (aboutHeld?.key === key) return [aboutHeld.item]
    const item: PaletteItem = {
      id: ABOUT_ROW, label: "Chat about this page", place: address.replace(/^\//, ""),
      search: `agents chat about this page ${name}`.toLowerCase(), taking: atOnce,
      action: { kind: "level", level: {
        kind: "value",
        placeholder: `Ask about ${name}…`,
        submitLabel: "Start chat",
        options: () => createMemo<ReadonlyArray<PaletteOption>>(previous => agents.engines().map(engine =>
          previous.find(option => option.id === engine.id && option.label === engine.name) ?? { id: engine.id, label: engine.name }), []),
        validate: text => text.trim() === "" ? "Type a message first." : null,
        submit: async (text, engine, signal) => {
          if (engine === undefined) return { keepOpen: true, said: { tone: "alarm", text: "No agent is set up" } }
          setSending(true)
          signal.addEventListener("abort", () => setSending(false), { once: true })
          // ONE PRESS OF THE DOOR (`./Door.tsx`'s `sendAbout`): a refusal keeps
          // the words in this box with the sentence beside them, and leaves the
          // docked conversation alone.
          const sent = await sendAbout({ about: address, name, engine: engine.id, text })
          if (sent.started === null) return { keepOpen: true, said: { tone: "alarm", text: sent.said ?? "No chat was started" } }
          const door = dock()
          if (sent.talking && door?.desktop()) door.open(sent.started)
          return {}
        },
      } },
    }
    aboutHeld = { key, item }
    return [item]
  }
  return { items: (): ReadonlyArray<PaletteItem> => {
    // ONLY WHAT WORKS: with no engine this machine can start, there is no
    // `new chat` row to choose — the plugins panel says why.
    const creating: ReadonlyArray<PaletteItem> = agents.engines().length === 0 || newChat === undefined ? [] : [newChat]
    return [...creating, ...about(), ...above(), ...sleeping(), ...byActivity(agents.rows()).map((row): PaletteItem => {
      const named = agents.named(row)
      return {
        id: `agent-${row.id}`, label: named.name, hint: LOOK[row.standing].label,
        ...(named.mark === undefined ? {} : { mark: named.mark }),
        // A chat about a place says where it is on the second line.
        place: named.where === undefined ? "Agents" : `Agents · ${named.where}`,
        search: `agents ${named.name} ${named.where ?? ""}`.trim().toLowerCase(), taking: atOnce,
        action: { kind: "run", run: async () => {
          const nav = navigation()
          if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "Can't open this right now" } }
          focusAgent(nav, agents, row)
          return {}
        } },
      }
    })]
  } }
}
