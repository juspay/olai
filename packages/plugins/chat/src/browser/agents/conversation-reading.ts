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
  /**
   * THE CONVERSATION A VIEW BELONGS TO, which is not the view's own value.
   *
   * `reading.conversation` answers the shared `Chat` for one engine/session
   * (or one node while unbound), and that object is stable while a reader
   * holds it. The view below is a thin wrapper — it adds `loadSession` bound
   * to this node — and used to be recreated on every recompute, so a tick of
   * `pair`/`hasPanel` that left the conversation alone still changed the
   * value the fold's keyed `<Show>` watches: the panel (and its history
   * picker) remounted under an open list. The pair below is what those
   * observers are actually about, so it is what the memo compares.
   */
  const belonging = createMemo(() => {
    if (!reading || !hasPanel()) return null
    const to = pair()
    // Once bound, the session pair is the subscription identity. Switching
    // from a node address to the same history entry keeps the same reading.
    const at = to ?? address()
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
