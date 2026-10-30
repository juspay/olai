import { createSignal } from "solid-js"
import { Result } from "effect"
import type { PaletteAdapter, PaletteItem } from "olai-plugin-navigation/contract"
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
import type { Roster } from "./answered.tsx"

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
   * THE PASS, AND THE ANSWER THAT LETS IT RUN — two rows, both about the
   * conversation a person is LOOKING AT (`../verbs.tsx` has the menu's halves).
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
   * THE FIRST IS THE OPT-IN, and its LABEL is the indicator: nothing is tidied
   * on its own until somebody says so, and the row says which way the press will
   * go (`sleeps`, joined onto the roster row). The second is the pass itself,
   * asked for now, on a node the loop would never have picked up.
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
        place: `on “${shown.title}”`,
        // THE WORDS THAT ARE ON SCREEN, both of them: the label flips with the
        // mark, and a search that spelled only the "on" one left a person who
        // typed what they could see — "stop" — with no row at all.
        search: `${shown.sleeps ? "stop sleeping when idle" : "sleep when idle"} ${shown.title}`.toLowerCase(),
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
      {
        id: "sleep-now", label: "Sleep now", place: `on “${shown.title}”`,
        search: `sleep now ${shown.title}`.toLowerCase(), taking: atOnce,
        action: { kind: "run", run: async () => {
          const outcome = await runAsync(chatWire().procedures.conversation.sleepNow({ node: shown.id }))
          if (Result.isFailure(outcome)) return { keepOpen: true, said: { tone: "alarm" as const, text: outcome.failure.message } }
          if (outcome.success._tag === "Started") return {}
          return { keepOpen: true, said: { tone: "alarm" as const, text: outcome.success.said } }
        } },
      },
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
      id: "open-agent-above", label: "Open the agent above", place: `on “${row.title}”`,
      search: `open the agent above ${row.title}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: async () => {
        const nav = navigation()
        if (nav === undefined) return { keepOpen: true, said: { tone: "alarm" as const, text: "Can't open this right now" } }
        const now = hereNow()
        const target = now === null ? undefined : agentAboveOf(now, agents)
        if (target !== undefined) focusAgent(route => nav.go(route), target)
        return {}
      } },
    }]
  }
  return { items: (): ReadonlyArray<PaletteItem> => {
    // ONLY WHAT WORKS: with no engine this machine can start, there is no
    // `new chat` row to choose — the plugins panel says why.
    const creating: ReadonlyArray<PaletteItem> = agents.engines().length === 0 || newChat === undefined ? [] : [newChat]
    return [...creating, ...above(), ...sleeping(), ...byActivity(agents.rows()).map((row): PaletteItem => ({
      id: `agent-${row.id}`, label: row.title, hint: LOOK[row.standing].label,
      place: "Agents", search: `agents ${row.title}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: async () => {
        const nav = navigation()
        if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "Can't open this right now" } }
        focusAgent(route => nav.go(route), row)
        return {}
      } },
    }))]
  } }
}
