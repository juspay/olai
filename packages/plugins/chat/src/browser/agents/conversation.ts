import { createEffect, createMemo, type Accessor } from "solid-js"
import type { PanelAddress } from "../../wire/session.ts"
import { createChat } from "../chat/state.ts"
import { createAsked } from "../chat/attention/asked.ts"
import { agentReadings, readAgent } from "./reading.ts"

/** Resolve history against the live binding and acquire the visible conversation.
 * The caller’s Solid owner releases its subscription and question tracking;
 * shared drafts and visits remain owned by the chat activation.
 */
export const createNodeConversation = (node: Accessor<string>) => {
  const reading = agentReadings()
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    return agent?.session == null ? null
      : reading?.visiting(node()) ?? { agent: agent.engine, session: agent.session }
  }, null, { equals: (a, b) => a?.agent === b?.agent && a?.session === b?.session })
  const hasPanel = createMemo(() => {
    const agent = reading?.agents.at(node())
    return agent !== undefined && (agent.session !== null || agent.unopened === true)
  })
  const address = createMemo<PanelAddress>(() => reading?.visiting(node()) ?? { node: node() }, undefined,
    { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) })
  const chat = createMemo(() => {
    const to = pair()
    if (!hasPanel()) return null
    const at = address()
    const chat = createChat(at, { ui: reading?.ui(to ?? at), visit: to => reading?.visit(node(), to) })
    readAgent(node(), chat)
    const question = createAsked(chat)
    createEffect(() => chat.ui.question[1](question()))
    return chat
  })
  return { pair, chat }
}
