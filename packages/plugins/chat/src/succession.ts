import type { Listed, SessionInfo } from "olai-plugin-chat/wire"
import { chatKey } from "./lineage.ts"
import type { Conversing, Overheard } from "./sessions.ts"

export const succeeded = (
  listed: Listed,
  overheard: ReadonlyArray<Overheard>,
): Listed => {
  const links = overheard.filter((row) => row.superseded !== undefined)
  if (links.length === 0) return listed
  const sessions = listed.sessions.map((session): SessionInfo => {
    const link = links.find(
      (row) => row.agent === session.agent && row.session === session.id,
    )
    let next: Conversing | null = link?.superseded ?? session.supersededBy
    const seen = new Set<string>([chatKey(session.agent, session.id)])
    while (next !== null && !seen.has(chatKey(next.agent, next.session))) {
      seen.add(chatKey(next.agent, next.session))
      const at = next
      if (listed.sessions.some((row) => row.agent === at.agent && row.id === at.session)) break
      const after = links.find((row) => row.agent === at.agent && row.session === at.session)?.superseded
      if (after === undefined) break
      next = after
    }
    const same = (next === null && session.supersededBy === null) ||
      (next !== null && session.supersededBy !== null
        && next.agent === session.supersededBy.agent && next.session === session.supersededBy.session)
    return same ? session : { ...session, supersededBy: next }
  })
  return { ...listed, sessions }
}
