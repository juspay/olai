import { createMemo, untrack, type Accessor } from "solid-js"
import type { PanelAddress } from "../../wire/session.ts"
import type { Chat } from "../chat/state.ts"
import type { createAgentReadings } from "./reading.ts"

/** A page's lease follows its live binding or its explicit history visit. */
export const createConversation = (
  reading: ReturnType<typeof createAgentReadings> | undefined,
  node: Accessor<string>,
  shown: Accessor<boolean>,
) => {
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    const visited = reading?.visiting(node())
    if (visited !== undefined) return { agent: visited.agent, session: visited.session }
    // A refused fresh start still has the previous binding on disk. Its
    // sign-in/retry belongs to the unbound node, not that previous session.
    const resumed = reading?.resuming(node())
    if (agent?.session == null || (agent.unopened === true
      && (resumed?.agent !== agent.engine || resumed.session !== agent.session))) return null
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
      return view
    })
  })
  reading?.join(node, chat, shown)
  return { pair, chat }
}
