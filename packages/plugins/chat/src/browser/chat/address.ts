import { type ChatState, agentIn } from "olai-plugin-chat/wire"

export type Address = { readonly agent: string; readonly session: string }

export const addressOf = (state: ChatState): Address | undefined => {
  const agent = agentIn(state)
  return agent && state.session ? { agent: agent.id, session: state.session.id } : undefined
}

export const sameAddress = (before: Address | undefined, after: Address | undefined): boolean =>
  before?.agent === after?.agent && before?.session === after?.session
