import { useShown } from "olai-plugin-navigation/routing"
import { createEffect, createMemo, createRoot, createSignal, onCleanup, untrack, type Accessor } from "solid-js"
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
  const shown = useShown()
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    if (agent?.session == null) return null
    const visited = reading?.visiting(node())
    return { agent: visited?.agent ?? agent.engine, session: visited?.session ?? agent.session }
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
  const [chat, setChat] = createSignal<ReturnType<typeof createChat> | null>(null)
  createEffect(() => {
    const to = pair()
    const available = hasPanel()
    const at = address()
    const id = node()
    if (!available) { setChat(null); return }
    const dispose = untrack(() => createRoot(dispose => {
      onCleanup(() => setChat(null))
      const owned = createChat(at, { expected: to, ui: reading?.ui(to ?? at), visit: to => reading?.visit(id, to) })
      readAgent(id, owned, shown)
      const question = createAsked(owned)
      owned.ui.question.bind(question)
      setChat(owned)
      // Register this explicit root with the effect that owns the address.
      return dispose
    }))
    onCleanup(dispose)
  })
  return { pair, chat }
}
