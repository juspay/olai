import { servedDirectory } from "./vault.ts"
/** Row actions and the palette share one server-owned ancestor query. */
import type { AppCommand } from "olai-plugin-navigation/slots"
import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
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

/**
 * ONE ENTRY per gesture, however many engines: the verb itself when only one
 * engine can start, and a choice of the engines that can (`RowChoice`, drawn
 * by outlines as a submenu) when several can. Engines this machine lacks are
 * never offered; the plugins panel says what they need.
 */
const oneOrChoice = (
  id: string,
  label: string,
  engines: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  verb: (engine: { readonly id: string; readonly name: string }) => Omit<RowVerb, "id" | "label" | "writes">,
): ReadonlyArray<RowAction> => {
  if (engines.length === 0) return []
  if (engines.length === 1) return [{ id: `${id}-${engines[0]!.id}`, label, writes: true, ...verb(engines[0]!) }]
  return [{
    id, label, writes: true,
    choices: engines.map(engine => ({ id: `${id}-${engine.id}`, label: engine.name, writes: true, ...verb(engine) })),
  }]
}

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
    return oneOrChoice("start-agent", "Start an agent", engines, engine => ({ run: startOn(engine) }))
  }
  // A node already talking through a conversation: `Fresh start` — the node's
  // own engine first, a choice only where there is one — and CLOSE, releasing
  // the node's agent back to the unclaimed chats (the conversation is filed
  // back under Chats by the next filer run).
  const available = roster.engines()
  const current = available.find(engine => engine.id === bound.engine)
  const engines = current === undefined ? available : [current, ...available.filter(engine => engine !== current)]
  return [
    ...oneOrChoice("fresh-start", "Fresh start", engines, engine => ({
      confirm: freshStartQuestion(bound.title),
      run: startOn(engine),
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
