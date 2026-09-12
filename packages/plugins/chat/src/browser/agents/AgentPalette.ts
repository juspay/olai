import type { PaletteAdapter, PaletteItem } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { navigation } from "../navigation.ts"
import { agentReadings } from "./reading.ts"
import { rowOf } from "./focus.ts"
import { unfold } from "./folding.ts"
import { byActivity } from "./activity-order.ts"
import { LOOK } from "./roster.ts"
import type { Roster } from "./answered.tsx"

/** The non-rendering contribution receives the activation's same roster. It
 * opens a reading only when a row is selected, never while listing agents. */
export const createAgentPalette = (agents: Roster): PaletteAdapter => ({
  items: (): ReadonlyArray<PaletteItem> => byActivity(agents.rows()).map(row => ({
    id: `agent-${row.id}`, label: row.title, hint: LOOK[row.standing].label,
    place: "Agents", search: `agents ${row.title}`.toLowerCase(), taking: atOnce,
    action: { kind: "run", run: async () => {
      const nav = navigation()
      if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "navigation is unavailable" } }
      nav.go(rowOf(row))
      agentReadings()?.visit(row.id)
      if (row.session !== null) unfold(row.id)
      return {}
    } },
  })),
})
