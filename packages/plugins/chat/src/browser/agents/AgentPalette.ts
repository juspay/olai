import { servedDirectory } from "../vault.ts"
import { createEffect, createSignal } from "solid-js"
import type { PaletteAdapter, PaletteItem } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { navigation, palette } from "../navigation.ts"
import { agentReadings } from "./reading.ts"
import { rowOf } from "./focus.ts"
import { unfold } from "./folding.ts"
import { byActivity } from "./activity-order.ts"
import { LOOK } from "./roster.ts"
import type { Roster } from "./answered.tsx"

/** Listing reads the activation's roster; only selection opens a conversation. */
export const createAgentPalette = (agents: Roster): PaletteAdapter => {
  const creation = agentReadings()!.newChat
  const [choosing, choose] = createSignal(false)
  createEffect(() => { if (!palette()?.open()) choose(false) })
  const start = async (agent: string) => {
    const said = await creation.start(agent)
    return said === undefined ? {} : { keepOpen: true, said }
  }
  return { items: (): ReadonlyArray<PaletteItem> => {
    if (choosing()) return agents.engines().map(engine => ({
      id: `new-chat-engine-${engine.id}`, label: engine.name,
      search: `agents new chat ${engine.name}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: () => start(engine.id) },
    }))
    return [{ id: "new-chat", label: "new chat", place: "Agents", search: "agents new chat", taking: atOnce,
      action: { kind: "run", run: async () => {
        const only = agents.engines()[0]
        if (only === undefined) return { keepOpen: true, said: { tone: "alarm", text: "no agent engine is available" } }
        if (agents.engines().length === 1) return start(only.id)
        choose(true)
        return { keepOpen: true }
      } } }, ...byActivity(agents.rows()).map((row): PaletteItem => ({
      id: `agent-${row.id}`, label: row.title, hint: LOOK[row.standing].label,
      place: "Agents", search: `agents ${row.title}`.toLowerCase(), taking: atOnce,
      action: { kind: "run", run: async () => {
        const nav = navigation()
        if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "navigation is unavailable" } }
        const claims = servedDirectory()?.claims()
        if (claims === undefined) return { keepOpen: true, said: { tone: "alarm", text: "the vault is unavailable" } }
        nav.go(rowOf(claims, row))
        agentReadings()?.visit(row.id)
        if (row.session !== null) unfold(row.id)
        return {}
      } },
    }))]
  } }
}
