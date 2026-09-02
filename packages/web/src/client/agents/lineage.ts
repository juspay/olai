/**
 * WHICH CONVERSATIONS A NODE AGENT HAS HAD, and which ones nobody has claimed.
 *
 * Two readings of one walk, and they are the two halves of migration: a chat
 * that no node claims is a row under **Unassigned**, and a chat some node
 * claims is that agent's session — its CURRENT one, or one of the ones before
 * it. Neither is a fact either wire carries: the `agents` cell says which
 * conversation each node's property names (one id, the current one), and
 * `chat.sessions` says what every installed agent has stored, each row saying
 * which conversation replaced it where somebody said so (`@olai/surface`'s
 * `SessionInfo`). The lineage is the join, and this module is the rule for it.
 *
 * ## A CHAIN, because `/clear` leaves one
 *
 * `/clear` ends a conversation and starts another, and olai's pinned adapter
 * says so on the row that was left behind ({@link SessionInfo.supersededBy});
 * olai says the same thing about a replacement IT made, through the same field
 * (`@olai/chat`'s `succession.ts`). Either way the fact points FORWARD — this
 * one was replaced by that one — so a node agent's history is walked BACKWARDS
 * from the session its property names: which conversation was replaced by this
 * one, and which by that.
 *
 * Assigning a chat therefore claims its whole chain in one gesture, which is
 * the design's own promise: the panel's *past sessions* is populated from day
 * one rather than starting empty and filling as somebody clears.
 *
 * ## MATCHED ON THE PAIR, never on the session alone
 *
 * A session id belongs to one agent's own space and two agents can collide
 * formally, so every step of the walk carries the engine — the same rule the
 * picker's own successor lookup keeps (`../chat/Sessions.tsx`), and the same
 * one the record keeps a package away.
 *
 * ## WHAT IS NOT HERE
 *
 * Nothing is inferred. Two rows sharing a title are two conversations; a chain
 * exists where somebody SENT the link and nowhere else. And a node agent whose
 * property names no session claims nothing at all — an unbound node agent has
 * no history, which is exactly what makes Unassigned the doorway to it.
 *
 * PURE over the two lists, for `./roster.ts`'s reason: this decides what a
 * person is offered to migrate, and reaching it through a browser is not how
 * anybody should have to check that a conversation a node already claims is not
 * offered to be claimed again.
 */

import type { Agents, SessionInfo } from "@olai/surface"

/** The key one conversation is identified by, everywhere in this module — the
 *  PAIR, spelled once so the walk and the claim cannot come to disagree about
 *  a session id two agents both happen to use. */
const keyOf = (agent: string, session: string): string => `${agent}/${session}`

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
  const seen = new Set<string>([keyOf(agent, session)])
  let at = session
  for (;;) {
    const before = sessions.find(
      (row) => row.agent === agent && row.supersededBy === at,
    )
    if (before === undefined) return past
    const key = keyOf(before.agent, before.id)
    if (seen.has(key)) return past
    seen.add(key)
    past.push(before)
    at = before.id
  }
}

/**
 * EVERY CONVERSATION SOME NODE CLAIMS — the current sessions and their chains,
 * as the keys {@link unassignedIn} tests against.
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
    claimed.add(keyOf(agent.engine, agent.session))
    for (const past of pastOf(sessions, agent.engine, agent.session)) {
      claimed.add(keyOf(past.agent, past.id))
    }
  }
  return claimed
}

/**
 * ... AND THE CONVERSATIONS NOBODY CLAIMS, in the order the listing answers,
 * which is newest first across every installed agent.
 *
 * This is the whole of what **Unassigned** holds. It may never empty, and that
 * is the design's own note rather than a state to fix: a chat that is nobody's
 * agent goes on working exactly as it always did.
 */
export const unassignedIn = (
  sessions: ReadonlyArray<SessionInfo>,
  agents: Agents,
): ReadonlyArray<SessionInfo> => {
  const claimed = claimedIn(sessions, agents)
  return sessions.filter((row) => !claimed.has(keyOf(row.agent, row.id)))
}
