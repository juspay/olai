import { servedDirectory } from "./vault.ts"
/** Row actions and the palette share one server-owned ancestor query. */
import type { AppCommand } from "olai-plugin-navigation/slots"
import type { RowAction } from "olai-plugin-outlines/slots"
import { atElement } from "olai-plugin-navigation/routes"
import { Result } from "effect"
import { runAsync } from "@olai/web/client/run.ts"
import type { Roster } from "./agents/answered.tsx"
import { agentReadings } from "./agents/reading.ts"
import { fold, unfold } from "./agents/folding.ts"
import { focusedNode } from "./references.ts"
import { navigation } from "./navigation.ts"
import { chatWire } from "./wire.ts"

import { freshStartQuestion } from "./agents/fresh-start.ts"

const NO_AGENT = "No agent here. Start one first."
const target = async (node: string | null) => {
  if (node === null) return NO_AGENT
  const found = await runAsync(chatWire().procedures.conversation.agentAbove({ node }))
  if (Result.isFailure(found)) return found.failure.message
  if (found.success === null) return NO_AGENT
  if (found.success.session === null) return "This agent has no chat. Start one first."
  return { ...found.success, session: found.success.session }
}
const show = (agent: { node: string; file: string }) => {
  agentReadings()?.visit(agent.node)
  const claims = servedDirectory()?.claims()
  if (claims !== undefined) navigation()?.go(atElement(claims, agent.file, agent.node))
  unfold(agent.node)
}

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

export const createAskCommand = (): AppCommand => ({
  prefix: ">", said: "Ask the agent", placeholder: "Ask the agent…",
  run: async line => {
    const agent = await target(agentReadings()?.newChat.origin() ?? focusedNode())
    if (agent === NO_AGENT) return await agentReadings()?.newChat.open(line) ?? null
    if (typeof agent === "string") return agent
    const held = agentReadings()
    if (held === undefined) return "Chat stopped"
    show(agent)
    const chat = await held.ready(agent.node, agent)
    if (typeof chat === "string") return chat
    const current = held.agents.at(agent.node)
    if (current?.engine !== agent.agent || current.session !== agent.session) return "The agent's chat changed. Try again."
    const context = chat.ui.armed.releaseArmed()
    const outcome = await runAsync(chatWire().procedures.conversation.send({
      conv: { agent: agent.agent, session: agent.session }, scope: chat.state().uploadScope, text: line, context,
    }))
    if (Result.isSuccess(outcome)) return null
    chat.ui.armed.restoreArmed(context)
    return outcome.failure.message
  },
})
