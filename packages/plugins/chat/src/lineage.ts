import type { Agents, Conversing, SessionInfo } from "olai-plugin-chat/wire"

export const chatKey = (agent: string, session: string): string => `${agent}/${session}`

export const pastOf = (
  sessions: ReadonlyArray<SessionInfo>,
  agent: string,
  session: string,
): ReadonlyArray<SessionInfo> => {
  const past: Array<SessionInfo> = []
  const seen = new Set<string>([chatKey(agent, session)])
  let at: Conversing = { agent, session }
  for (;;) {
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
