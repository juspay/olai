/**
 * The stored conversations, ARRANGED BY WHO THEY ARE WITH.
 *
 * The server answers one list, newest first, every row saying whose it is
 * (`../../../../chat/src/listings.ts`). That is the right shape for the wire —
 * a conversation belongs to an agent, and the row carries it — and the wrong
 * shape for a reader: two agents' conversations interleaved by timestamp is a
 * list you have to read every line of to find the one you want, and the thing
 * you know about the one you want is who it was with.
 *
 * So the drawing regroups, and it does it HERE rather than inside the list
 * because it is a rule with two edges worth pinning: the ORDER of the groups
 * (the roster's, which is the same order the picker offers agents in — a person
 * should not have to learn two) and WHICH GROUPS EXIST (only the ones with a
 * conversation in them, so an installed agent you have never used is not a
 * heading over nothing).
 *
 * It takes the roster rather than reading the agents off the rows, and that is
 * the reason the order is stable: rows tell you which agents HAVE conversations,
 * in the order those conversations were last touched, which would move a whole
 * group up the list because somebody sent one message.
 */

import type { AgentChoice, SessionInfo } from "@olai/surface"

/** One agent's conversations, under the agent. */
export interface Grouped {
  readonly agent: AgentChoice
  /** In the order they arrived, which is newest first. */
  readonly sessions: ReadonlyArray<SessionInfo>
}

/**
 * Group the list, in the roster's order, dropping the agents with nothing.
 *
 * A row naming an agent that is NOT on the roster is dropped, and cannot arrive:
 * the server builds this list by asking the roster, and the roster is the same
 * value this is called with. Were one to arrive anyway it would be a
 * conversation nothing on this machine could open, so a heading for it would be
 * an offer that refuses.
 */
export const groupedByAgent = (
  sessions: ReadonlyArray<SessionInfo>,
  roster: ReadonlyArray<AgentChoice>,
): ReadonlyArray<Grouped> => {
  const groups: Array<Grouped> = []
  for (const agent of roster) {
    const mine = sessions.filter((session) => session.agent === agent.id)
    if (mine.length > 0) groups.push({ agent, sessions: mine })
  }
  return groups
}
