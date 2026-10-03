/** The row menu's agent verbs: start, fresh start, close. */
import type { RowAction } from "olai-plugin-outlines/slots"
import { Result } from "effect"
import { runAsync } from "@olai/web/client/run.ts"
import type { Roster } from "./agents/answered.tsx"
import { agentReadings } from "./agents/reading.ts"
import { fold, unfold } from "./agents/folding.ts"
import { chatWire } from "./wire.ts"

import { freshStartQuestion } from "./agents/fresh-start.ts"

/**
 * ONE ENTRY per gesture, however many engines: a choice of the engines that
 * can start (`RowChoice`), which outlines draws as a submenu, as the verb
 * itself when there is one, and not at all when there are none. Engines this
 * machine lacks are never offered; the plugins panel says what they need.
 */
export const rowVerbs = (node: string, roster: Roster): ReadonlyArray<RowAction> => {
  /** THE START GESTURE, SHARED BY BOTH HALVES: start a session on a node with
   *  a given engine, and on success mark the node read and unfold it. The
   *  start and fresh-start entries are the same act on different labels. */
  const startOn = (engine: { readonly id: string }) => async (node: string) => {
    const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
    if (Result.isFailure(outcome)) return outcome.failure.message
    agentReadings()?.visit(node)
    unfold(node)
  }
  const bound = roster.at(node)
  if (bound?.session == null) {
    // A bare row, or one naming only an engine: `Start an agent` — a choice of
    // every engine that can start on a bare row, the named engine alone on a
    // sessionless one, and nothing when none can.
    const engines = bound?.engine != null
      ? roster.engines().filter(engine => engine.id === bound.engine) : roster.engines()
    return [{
      id: "start-agent", label: "Start an agent", writes: true,
      choices: engines.map(engine => ({ id: `start-agent-${engine.id}`, label: engine.name, writes: true, run: startOn(engine) })),
    }]
  }
  // A node already talking through a conversation: `Fresh start` — the node's
  // own engine first, a choice only where there is one — and CLOSE, releasing
  // the node's agent back to the unclaimed chats (the conversation is filed
  // back under Chats by the next filer run).
  const available = roster.engines()
  const current = available.find(engine => engine.id === bound.engine)
  const engines = current === undefined ? available : [current, ...available.filter(engine => engine !== current)]
  return [
    {
      id: "fresh-start", label: "Fresh start", writes: true,
      choices: engines.map(engine => ({
        id: `fresh-start-${engine.id}`, label: engine.name, writes: true,
        confirm: freshStartQuestion(bound.title), run: startOn(engine),
      })),
    },
    {
      id: "close-agent", writes: true, label: "Close the agent",
      run: async (node: string) => {
        const outcome = await runAsync(chatWire().procedures.conversation.closeAgent({ node }))
        if (Result.isFailure(outcome)) return outcome.failure.message
        fold(node)
      },
    },
  ]
}
