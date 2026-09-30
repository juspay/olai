/** Resolve history against the live binding and acquire the visible conversation.
 * The caller’s Solid owner releases its subscription and question tracking;
 * shared drafts and visits remain owned by the chat activation.
 */
import { keepMessage } from "../chat/message-draft.ts"
import { createEffect, createMemo, type Accessor } from "solid-js"
import { createChat } from "../chat/state.ts"
import { createAsked } from "../chat/attention/asked.ts"
import { agentReadings, readAgent } from "./reading.ts"


export const createNodeConversation = (node: Accessor<string>) => {
  const reading = agentReadings()
  const pair = createMemo(() => {
    const agent = reading?.agents.at(node())
    return agent?.session == null ? null
      : reading?.visiting(node()) ?? { agent: agent.engine, session: agent.session }
  }, null, { equals: (a, b) => a?.agent === b?.agent && a?.session === b?.session })
  const chat = createMemo(() => {
    const to = pair()
    if (to === null) return null
    const owner = node()
    const chat = createChat(to, {
      ui: reading?.ui(to), visit: to => reading?.visit(owner, to),
      current: () => {
        const bound = reading?.agents.at(owner)
        return bound?.engine === to.agent && bound.session === to.session
      },
      rewound: (next, text) => {
        const ui = reading?.ui(next)
        if (ui !== undefined) keepMessage(ui.messages, JSON.stringify([next.agent, next.session]), text)
        reading?.visit(owner)
      },
    })
    readAgent(owner, chat)
    const question = createAsked(chat)
    createEffect(() => chat.ui.question[1](question()))
    return chat
  })
  return { pair, chat }
}
