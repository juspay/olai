/**
 * WHICH CONVERSATION A PANEL IS SHOWING — the one memo every item on the standing
 * line reads, and a fact about the panel rather than about any of them.
 *
 * ITS OWN MODULE, and that is the whole reason it is not in `sleeping.ts` where it
 * was: the address is about a conversation, not about sleep, and the wake faces
 * and the line itself need it just as much as the sleep item does. A module that
 * owns two unrelated things is a module that has to be read, reviewed and
 * versioned for whichever of them moved — the sleep item's words would rev for a
 * change to how a panel names its conversation.
 *
 * IT WAS TWO COPIES BEFORE THAT, one in `Sleeping.tsx` and one in `Wake.tsx`, word
 * for word and with the same `equals`: the two were asked the same question about
 * the same state, so the answer is computed once and both read it.
 */

import { type ChatState, agentIn } from "olai-plugin-chat/wire"

/** WHICH AGENT AND WHICH CONVERSATION — a node agent's id and a session id, as
 *  the panel's own state names them. */
export type Address = { readonly agent: string; readonly session: string }

/** THE ADDRESS THIS PANEL IS SHOWING, or `undefined` for a panel with no agent —
 *  a plain chat, which has no node to mark and no wake to scope. */
export const addressOf = (state: ChatState): Address | undefined => {
  const agent = agentIn(state)
  return agent && state.session ? { agent: agent.id, session: state.session.id } : undefined
}

/** The memo’s own equality: two addresses are the same when they name the same
 *  agent and the same conversation, never because a frame re-built the object. A
 *  chat frame arrives several times a turn, and an item that re-resolved its row
 *  on every one of them would be re-reading the roster to learn nothing. */
export const sameAddress = (before: Address | undefined, after: Address | undefined): boolean =>
  before?.agent === after?.agent && before?.session === after?.session
