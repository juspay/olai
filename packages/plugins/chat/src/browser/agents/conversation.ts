import { useShown } from "olai-plugin-navigation/routing"
import { createMemo, untrack, type Accessor } from "solid-js"
import type { PanelAddress } from "../../wire/session.ts"
import type { Chat } from "../chat/state.ts"
import { agentReadings, readAgent } from "./reading.ts"

/** Resolve history against the live binding and acquire the visible conversation.
 * The caller’s Solid owner releases its subscription and question tracking;
 * shared drafts and visits remain owned by the chat activation.
 */
export const createNodeConversation = (node: Accessor<string>) => {
  const reading = agentReadings()
  const shown = useShown()
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    const visited = reading?.visiting(node())
    if (visited !== undefined) return visited
    // A refused fresh start still has the previous binding on disk. Its
    // sign-in/retry belongs to the unbound node, not that previous session.
    if (agent?.session == null || agent.unopened === true) return null
    return { agent: agent.engine, session: agent.session }
  }, null, { equals: (a, b) => a?.agent === b?.agent && a?.session === b?.session })
  const hasPanel = createMemo(() => {
    const agent = reading?.agents.at(node())
    return agent !== undefined && (agent.session !== null || agent.unopened === true)
  })
  const address = createMemo<PanelAddress>(() => {
    const visited = reading?.visiting(node())
    return visited === undefined ? { node: node() } : { agent: visited.agent, session: visited.session }
  }, { node: node() },
    { equals: (a, b) => "node" in a ? "node" in b && a.node === b.node : "session" in b && a.agent === b.agent && a.session === b.session })
  const chat = createMemo<Chat | null>(() => {
    if (!reading || !hasPanel()) return null
    const to = pair()
    // Once bound, the session pair is the subscription identity. Switching
    // from a node address to the same history entry keeps the same reading.
    const at = to ?? address()
    const id = node()
    return untrack(() => {
      const shared = reading.conversation(at, to)
      const view: Chat = { ...shared, loadSession: (agent, session) => reading.visit(id, { agent, session }) }
      readAgent(id, view, shown)
      return view
    })
  })
  return { pair, chat }
}
