import { Result } from "effect"
import type { PaletteAdapter, PaletteItem } from "olai-plugin-navigation/contract"
import { atOnce } from "@olai/web/client/settled.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import { navigation } from "../navigation.ts"
import { agentReadings } from "./reading.ts"
import { focusAgent } from "./focus.ts"
import { byActivity } from "./activity-order.ts"
import { hereNow, messageLevel, newChatRow } from "./new-chat-level.ts"
import { agentAboveOf } from "./above.ts"
import { LOOK } from "./roster.ts"
import { chatVerbs } from "../verbs.tsx"
import type { RowVerb } from "olai-plugin-outlines/slots"
import type { Roster } from "./answered.tsx"
import { nameOfNote } from "./called.ts"
import { noteHere } from "./here.ts"
import { chatRouteOf } from "./route.ts"
import { servedDirectory } from "../vault.ts"
import { talking } from "./roster.ts"

export const ABOUT_ROW = "chat-about-page"

const inPalette = (verb: RowVerb): boolean => verb.id !== "close-agent"

export const createAgentPalette = (agents: Roster): PaletteAdapter => {
  const creation = agentReadings()?.newChat
  const newChat = creation === undefined ? undefined : newChatRow(creation, agents)
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
        if (target !== undefined) focusAgent(nav, target)
        return {}
      } },
    }]
  }
  const about = (): ReadonlyArray<PaletteItem> => {
    const nav = navigation()
    if (nav === undefined || creation === undefined || agents.engines().length === 0) return []
    const at = nav.focusIndex()
    const pane = nav.panes()[at]
    const path = pane === undefined ? null : noteHere(servedDirectory()?.claims(), pane.route())
    if (path === null) return []
    if (talking(agents.chatOf({ kind: "note", path }))) return []
    const name = nameOfNote(servedDirectory()?.claims(), path)
    return [{
      id: ABOUT_ROW, label: "Chat about this page", place: path,
      search: `agents chat about this page ${name}`.toLowerCase(), taking: atOnce,
      action: { kind: "level", level: messageLevel(creation, agents, { kind: "note", path }, {
        placeholder: `Ask about ${name}…`,
        opened: () => nav.openRight(at, chatRouteOf({ kind: "note", path })),
      }) },
    }]
  }
  return { items: (): ReadonlyArray<PaletteItem> => {
    const creating: ReadonlyArray<PaletteItem> = agents.engines().length === 0 || newChat === undefined ? [] : [newChat]
    return [...creating, ...about(), ...above(), ...sleeping(), ...byActivity(agents.rows()).map((row): PaletteItem => {
      const named = agents.named(row)
      return {
        id: `agent-${row.id}`, label: named.name, hint: LOOK[row.standing].label,
        ...(named.mark === undefined ? {} : { mark: named.mark }),
        place: named.where === undefined ? "Agents" : `Agents · ${named.where}`,
        search: `agents ${named.name} ${named.where ?? ""}`.trim().toLowerCase(), taking: atOnce,
        action: { kind: "run", run: async () => {
          const nav = navigation()
          if (nav === undefined) return { keepOpen: true, said: { tone: "alarm", text: "Can't open this right now" } }
          focusAgent(nav, row)
          return {}
        } },
      }
    })]
  } }
}
