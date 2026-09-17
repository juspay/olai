/**
 * WHICH CONVERSATIONS A NODE AGENT HAS HAD, and which ones nobody has claimed.
 *
 * Two readings of one walk: a chat some node claims is that agent's session —
 * its CURRENT one, or one of the ones before it. Neither is a fact either wire
 * carries: the `agents` cell says which conversation each node's property
 * names (one id, the current one), and `chat.sessions` says what every
 * installed agent has stored, each row saying which conversation replaced it
 * where somebody said so (`@olai/surface`'s `SessionInfo`). The lineage is the
 * join, and this module is the rule for it.
 *
 * ## A CHAIN, because `/clear` leaves one
 *
 * `/clear` ends a conversation and starts another, and olai's pinned adapter
 * says so on the row that was left behind ({@link SessionInfo.supersededBy});
 * olai says the same thing about a replacement IT made, through the same field
 * (`olai-plugin-chat`'s `succession.ts`). Either way the fact points FORWARD — this
 * one was replaced by that one — so a node agent's history is walked BACKWARDS
 * from the session its property names: which conversation was replaced by this
 * one, and which by that.
 *
 * Assigning a chat therefore claims its whole chain in one gesture, which is
 * the design's own promise: the panel's *past sessions* is populated from day
 * one rather than starting empty and filling as somebody clears.
 *
 * ## MATCHED ON THE PAIR, because a fresh start may change engine
 *
 * A session id belongs to one agent's own space and two agents can collide
 * formally, so every step of the walk carries the engine — the same rule the row
 * that draws a successor keeps (`./browser/chat/Conversation.tsx`), and the same one
 * the record keeps a package away. The LINK ITSELF NAMES THE PAIR it points at
 * (the wire's `Conversing`), so the walker never assumes the successor runs on
 * the engine it is walking FOR: fresh start may hand the node to another
 * engine, and the chain stays one chain across the swap.
 *
 * ## WHAT IS NOT HERE
 *
 * Nothing is inferred. Two rows sharing a title are two conversations; a chain
 * exists where somebody SENT the link and nowhere else. And a node agent whose
 * property names no session claims nothing at all.
 *
 * PURE over the two lists: the browser and scheduler must agree which node
 * owns a historical session. This decides what the picker offers, and reaching
 * it through a browser is not how anybody should have to check that a
 * conversation a node already claims is not offered to be claimed again.
 */

import type { Agents, Conversing, SessionInfo } from "olai-plugin-chat/wire"

/** ... and that pair as ONE STRING, for the places a key is wanted: the set a
 *  walk marks off, and the signal saying which row has its search open. Spelled
 *  here so the faces that key by it and the walks that match on it cannot come
 *  to disagree about a slash. */
export const chatKey = (agent: string, session: string): string => `${agent}/${session}`

/**
 * THE CONVERSATIONS THIS ONE REPLACED, newest first — the node agent's *past
 * sessions*.
 *
 * The list starts at the conversation the property names and walks the links
 * backwards, so the first row is the one this session directly replaced. It is
 * EXCLUSIVE of the current session, which is what "past" means: the panel is in
 * that one, and a header detail counting it would say two about an agent that
 * has had one conversation and cleared it once.
 *
 * The session it starts from NEED NOT BE IN THE LIST, and that is not an edge
 * case: a conversation opened a moment ago may not be in an answer taken before
 * it, and an agent may have forgotten one it still has predecessors for. The
 * walk is over links pointing AT an id rather than over a row holding it.
 *
 * A CYCLE ENDS IT. Nothing should be able to produce one — a supersession
 * points at a conversation minted after it — but the links come off a wire and
 * off a state file, and a walk that trusted them could spin in a browser. What
 * a cycle costs is the chain ending early, which is a shorter history rather
 * than a hung tab.
 */
export const pastOf = (
  sessions: ReadonlyArray<SessionInfo>,
  agent: string,
  session: string,
): ReadonlyArray<SessionInfo> => {
  const past: Array<SessionInfo> = []
  const seen = new Set<string>([chatKey(agent, session)])
  let at: Conversing = { agent, session }
  for (;;) {
    // The LINK names its successor's full pair: the row that was replaced by
    // `at` is the one whose `supersededBy` pair IS `at`, whoever wrote it. A
    // walk that matched on the id alone could follow a Claude row's link to a
    // Codex row and back — the pair is what keeps the chain one chain.
    const before = sessions.find(
      (row) =>
        row.supersededBy !== null &&
        row.supersededBy.agent === at.agent &&
        row.supersededBy.session === at.session,
    )
    if (before === undefined) return past
    const key = chatKey(before.agent, before.id)
    if (seen.has(key)) return past
    seen.add(key)
    past.push(before)
    at = { agent: before.agent, session: before.id }
  }
}

/**
 * THE CONVERSATION THIS ONE NAMES AS ITS SUCCESSOR, where the list holds it —
 * `undefined` for a row that names none, and for one whose successor the list
 * no longer knows.
 *
 * Both absences are one answer on purpose: what a reader gets from the link is
 * the successor's NAME, so a link pointing at a row that has been deleted since
 * the stamp was earned has nothing left to say and is not drawn
 * (`./browser/chat/Conversation.tsx`).
 *
 * MATCHED ON THE PAIR, like every other step of a lineage: an id belongs to one
 * agent's own space, and a Claude row's link resolving to an opencode row would
 * be a lie by lookup.
 *
 * A SCAN rather than an index, which is the change from the map this replaced:
 * the map was built per open per face, and both faces wanted it, so the third
 * copy was the one that would have gone stale. A listing is tens of rows.
 */
export const successorIn = (
  sessions: ReadonlyArray<SessionInfo>,
  session: SessionInfo,
): SessionInfo | undefined => {
  const by = session.supersededBy
  return by === null
    ? undefined
    : sessions.find(
        (row) => row.agent === by.agent && row.id === by.session,
      )
}

/**
 * EVERY CONVERSATION SOME NODE CLAIMS — the current sessions and their chains,
 * as conversation keys.
 *
 * Exported for the one reader that wants the set rather than the difference:
 * nothing yet, and it is exported because it is the half worth asserting on its
 * own — "assigning a chat claims its predecessors too" is a sentence about this
 * set, and reading it out of a filtered list is reading it backwards.
 */
export const claimedIn = (
  sessions: ReadonlyArray<SessionInfo>,
  agents: Agents,
): ReadonlySet<string> => {
  const claimed = new Set<string>()
  for (const agent of agents) {
    if (agent.session === null) continue
    claimed.add(chatKey(agent.engine, agent.session))
    for (const past of pastOf(sessions, agent.engine, agent.session)) {
      claimed.add(chatKey(past.agent, past.id))
    }
  }
  return claimed
}
