import { createMemo, untrack, type Accessor } from "solid-js"
import type { PanelAddress } from "../../wire/session.ts"
import type { Chat } from "../chat/state.ts"
import { isPast } from "./past.ts"
import type { createAgentReadings } from "./reading.ts"
import { talking } from "./roster.ts"

export const createConversation = (
  reading: ReturnType<typeof createAgentReadings> | undefined,
  node: Accessor<string>,
  shown: Accessor<boolean>,
) => {
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    const visited = reading?.visiting(node())
    if (visited !== undefined) return { agent: visited.agent, session: visited.session }
    const resumed = reading?.resuming(node())
    if (agent?.session == null || (agent.unopened === true
      && (resumed?.agent !== agent.engine || resumed.session !== agent.session))) return null
    return { agent: agent.engine, session: agent.session }
  }, null, { equals: (a, b) => a?.agent === b?.agent && a?.session === b?.session })
  const hasPanel = createMemo(() => talking(reading?.agents.at(node())))
  const following = createMemo(() => !isPast(reading?.visiting(node()), reading?.agents.at(node())))
  const address = createMemo<PanelAddress>(() => {
    const visited = reading?.visiting(node())
    return visited === undefined ? { node: node() } : { agent: visited.agent, session: visited.session }
  }, { node: node() },
    { equals: (a, b) => "node" in a ? "node" in b && a.node === b.node : "session" in b && a.agent === b.agent && a.session === b.session })
  const belonging = createMemo(() => {
    if (!reading || !hasPanel()) return null
    const to = pair()
    const at = to === null ? address() : following() ? { ...to, current: true as const } : to
    return untrack(() => ({ shared: reading.conversation(at, to), node: node() }))
  }, null, {
    equals: (a, b) => a === b || (a !== null && b !== null && a.shared === b.shared && a.node === b.node),
  })
  const chat = createMemo<Chat | null>(() => {
    const current = belonging()
    if (current === null) return null
    const view: Chat = { ...current.shared, loadSession: (agent, session) => reading!.visit(current.node, { agent, session }) }
    return view
  })
  reading?.join(node, chat, shown)
  return { pair, chat }
}
