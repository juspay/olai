import type { PaletteAdapter, PaletteItem } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { navigation } from "../navigation.ts"
import { agentReadings } from "./reading.ts"
import { focusAgent } from "./focus.ts"
import { byActivity } from "./activity-order.ts"
import { LOOK } from "./roster.ts"
import type { Roster } from "./answered.tsx"

/** Listing reads the activation's roster; only selection opens a conversation. */
export const createAgentPalette = (agents: Roster): PaletteAdapter => {
  const creation = agentReadings()?.newChat
  return { items: (): ReadonlyArray<PaletteItem> => {
    // ONLY WHAT WORKS: with no engine this machine can start, there is no
    // `new chat` row to choose — the plugins panel says why.
    const creating: ReadonlyArray<PaletteItem> = agents.engines().length === 0 ? [] : [{
      id: "new-chat", label: "New chat", place: "Agents", search: "agents new chat", taking: atOnce,
      action: { kind: "run", run: async () => {
        const refusal = await creation?.open()
        return refusal ? { keepOpen: true, said: { tone: "alarm", text: refusal } } : {}
      } } }]
    return [...creating, ...byActivity(agents.rows()).map((row): PaletteItem => ({
      id: `agent-${row.id}`, label: row.title, hint: LOOK[row.standing].label,
      place: "Agents", search: `agents ${row.title}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: async () => {
        const nav = navigation()
        if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "Can't open this right now" } }
        if (!focusAgent(route => nav.go(route), row)) return { keepOpen: true, said: { tone: "alarm", text: "Your notes aren't available" } }
        return {}
      } },
    }))]
  } }
}
