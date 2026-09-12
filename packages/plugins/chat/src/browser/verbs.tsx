/** Row actions and the palette share one server-owned ancestor query. */
import type { AppCommand } from "olai-plugin-navigation/slots"
import type { RowAction } from "olai-plugin-outlines/slots"
import { atElement } from "olai-plugin-navigation/routes"
import { Result } from "effect"
import { runAsync } from "@olai/web/client/run.ts"
import type { Roster } from "./agents/answered.tsx"
import { agentReadings } from "./agents/reading.ts"
import { unfold } from "./agents/folding.ts"
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
  navigation()?.go(atElement(agent.file, agent.node))
  unfold(agent.node)
}

export const rowVerbs = (node: string, roster: Roster): ReadonlyArray<RowAction> => {
  const bound = roster.at(node)
  const engines = bound?.session != null ? [] : bound?.engine != null
    ? roster.engines().filter(engine => engine.id === bound.engine) : roster.engines()
  return [{
    id: "ask-agent", label: "Ask agent", writes: false,
    run: async node => {
      const agent = await target(node)
      if (typeof agent === "string") return agent
      agentReadings()?.ui(agent).armed.armNode(node)
      show(agent)
    },
  }, ...engines.map(engine => ({
    id: `start-agent-${engine.id}`, writes: true,
    label: engines.length === 1 ? "Start an agent session" : `Start an agent session — ${engine.name}`,
    run: async (node: string) => {
      const outcome = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine.id }))
      if (Result.isFailure(outcome)) return outcome.failure.message
      agentReadings()?.visit(node)
      unfold(node)
    },
  }))]
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
