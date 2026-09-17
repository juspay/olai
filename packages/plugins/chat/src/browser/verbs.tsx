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

const NO_AGENT = "no agent above this row — start one"
const target = async (node: string | null) => {
  if (node === null) return NO_AGENT
  const found = await runAsync(chatWire().procedures.conversation.agentAbove({ node }))
  if (Result.isFailure(found)) return found.failure.message
  if (found.success === null) return NO_AGENT
  if (found.success.session === null) return "this agent has no session — start one"
  return { ...found.success, session: found.success.session }
}
const show = (agent: { node: string; file: string }) => {
  agentReadings()?.visit(agent.node)
  const claims = servedDirectory()?.claims()
  if (claims !== undefined) navigation()?.go(atElement(claims, agent.file, agent.node))
  unfold(agent.node)
}

export const rowVerbs = (node: string, roster: Roster): ReadonlyArray<RowAction> => {
  const bound = roster.at(node)
  if (bound?.session == null) {
    // A bare row, or one naming only an engine: the start gesture for each
    // engine it may use — one per installed engine on a bare row, one for the
    // named engine on a sessionless one, none when nothing is installed.
    const engines = bound?.engine != null
      ? roster.engines().filter(engine => engine.id === bound.engine) : roster.engines()
    return engines.map(engine => ({
      id: `start-agent-${engine.id}`, writes: true,
      label: engines.length === 1 ? "Start an agent session" : `Start an agent session — ${engine.name}`,
      run: async (node: string) => {
        const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
        if (Result.isFailure(outcome)) return outcome.failure.message
        agentReadings()?.visit(node)
        unfold(node)
      },
    }))
  }
  // A node already talking through a conversation: fresh start — one entry per
  // installed engine, the label naming the engine only where there is a
  // choice — and CLOSE, releasing the node back to Unassigned.
  const engines = roster.engines()
  if (engines.length === 0) return []
  return [
    ...engines.map(engine => ({
      id: `fresh-start-${engine.id}`, writes: true,
      label: engines.length === 1 ? "Fresh start" : `Fresh start — ${engine.name}`,
      run: async (node: string) => {
        const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
        if (Result.isFailure(outcome)) return outcome.failure.message
        agentReadings()?.visit(node)
        unfold(node)
      },
    })),
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
  prefix: ">", said: "ask the agent", placeholder: "ask the agent…",
  run: async line => {
    const agent = await target(focusedNode())
    if (typeof agent === "string") return agent
    const held = agentReadings()
    if (held === undefined) return "chat stopped"
    show(agent)
    const chat = await held.ready(agent.node, agent)
    if (typeof chat === "string") return chat
    const current = held.agents.at(agent.node)
    if (current?.engine !== agent.agent || current.session !== agent.session) return "the agent's session changed — try again"
    const context = chat.ui.armed.releaseArmed()
    const outcome = await runAsync(chatWire().procedures.conversation.send({
      conv: { agent: agent.agent, session: agent.session }, scope: chat.state().uploadScope, text: line, context,
    }))
    if (Result.isSuccess(outcome)) return null
    chat.ui.armed.restoreArmed(context)
    return outcome.failure.message
  },
})
