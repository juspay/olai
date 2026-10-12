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
import { newChatRow } from "./new-chat-level.ts"
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
   * THE PASS, ASKED FOR BY HAND — the same verb the row's `•••` offers
   * (`../verbs.tsx`), for a person whose hands are on the keyboard.
   *
   * A ROW PER NODE AGENT rather than one for the zoomed node, which is the
   * difference between this and the `•••`: the menu hangs off a row and this
   * list is opened from anywhere, so what says which node a row is about is the
   * row's own `place` — the same second line an `Agents` row already carries
   * and for the same reason.
   *
   * THE REFUSAL IS THE PALETTE'S OWN LINE, in the palette's own mood
   * (`{@link PaletteRunResult}`), and the sentence is the server's: a pass is
   * already running, or `sleep` is off in this directory's settings. Nothing is
   * drawn differently for it — a row that vanished when it could not run would
   * be a row whose absence has no explanation.
   */
  const tidying = (row: { readonly id: string; readonly title: string }): PaletteItem => ({
    id: `tidy-${row.id}`, label: "Tidy memory now", place: `on “${row.title}”`,
    search: `tidy memory sleep ${row.title}`.toLowerCase(), taking: atOnce,
    action: { kind: "run", run: async () => {
      const outcome = await runAsync(chatWire().procedures.conversation.sleepNow({ node: row.id }))
      if (Result.isFailure(outcome)) return { keepOpen: true, said: { tone: "alarm" as const, text: outcome.failure.message } }
      if (outcome.success._tag === "Started") return {}
      return { keepOpen: true, said: { tone: "alarm" as const, text: outcome.success.said } }
    } },
  })
  return { items: (): ReadonlyArray<PaletteItem> => {
    // ONLY WHAT WORKS: with no engine this machine can start, there is no
    // `new chat` row to choose — the plugins panel says why.
    const creating: ReadonlyArray<PaletteItem> = agents.engines().length === 0 || newChat === undefined ? [] : [newChat]
    // ... AND THE SAME ROWS THE `•••` OFFERS THE PASS ON: a node agent with a
    // session. A bare row has no memory to tidy yet — it has no conversation
    // either — and the loop would have nothing to hand a turn to.
    return [...creating, ...byActivity(agents.rows()).flatMap((row): ReadonlyArray<PaletteItem> => [
      {
        id: `agent-${row.id}`, label: row.title, hint: LOOK[row.standing].label,
        place: "Agents", search: `agents ${row.title}`.toLowerCase(), taking: atOnce,
        action: { kind: "run", run: async () => {
          const nav = navigation()
          if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "Can't open this right now" } }
          focusAgent(route => nav.go(route), row)
          return {}
        } },
      },
      ...(row.session == null ? [] : [tidying(row)]),
    ])]
  } }
}
