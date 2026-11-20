import type { Conversing, LiveSession, Overheard } from "olai-plugin-chat"
import {
  declarationsOf,
  isRegular,
  type Derived,
  itemOf,
  keysDeclaredAs,
  nearestAtOrAbove,
  NO_AGENTS,
  type NodeAgent,
  type NodeAgents,
  type Reading,
  seatableIn,
  seatableNote,
  textDeclaredAs,
} from "@olai/format"
import { type Agents, NO_AGENT_ROSTER } from "olai-plugin-chat/wire"

import { rosterIn } from "../seating.ts"
import type { Forecast } from "../wire/agents.ts"
import { OPENS_TYPE, ownKinds, SLEEPING_TYPE, SLEPT_TYPE, SESSION_TYPE } from "../kinds.ts"

export type RosterReading = Pick<Reading, "set" | "claims" | "derived">

export interface Roster {
  readonly seen: (reading: RosterReading | null) => void
  readonly agentAt: (to: Conversing) => NodeAgent | null
  readonly nodeAt: (item: string) => NodeAgent | null
  readonly seatableAt: (item: string) => boolean
  readonly nodes: () => NodeAgents
  readonly reading: () => Derived | null
  readonly key: () => string
  readonly keys: () => ReadonlyArray<string>
  readonly sleptKey: () => string
  readonly sleptKeys: () => ReadonlyArray<string>
  readonly sleptAt: (node: string) => string | null
  readonly sleepKey: () => string
  readonly sleepKeys: () => ReadonlyArray<string>
  readonly opensKey: () => string
  readonly opensKeys: () => ReadonlyArray<string>
  readonly sleeps: (node: string) => boolean
  readonly nearestAt: (node: string, candidates: ReadonlySet<string>) => string | null
  readonly rowsWith: (
    overheard: ReadonlyArray<Overheard>,
    live?: ReadonlyMap<string, LiveSession>,
    sleep?: (node: string) => Forecast | null,
  ) => Agents
}

export const roster = (): Roster => {
  let held: NodeAgents = NO_AGENTS
  let read: RosterReading | null = null
  const OWN_WORDS = [SESSION_TYPE, SLEPT_TYPE, SLEEPING_TYPE, OPENS_TYPE] as const
  const claimedOnly = (): ReadonlyMap<string, ReadonlyArray<string>> =>
    new Map(OWN_WORDS.map((word) => [word, [word]]))
  let declaredKeys: ReadonlyMap<string, ReadonlyArray<string>> = claimedOnly()
  const keysOf = (word: string): ReadonlyArray<string> => declaredKeys.get(word) ?? [word]
  const keyOf = (word: string): string => keysOf(word)[0] ?? word
  const nearest = (node: string, candidates: ReadonlySet<string>): string | null =>
    read === null ? null : nearestAtOrAbove(read.derived, node, candidates)
  const sleeping = (node: string): boolean => {
    if (read === null) return false
    const at = read.derived.byId.get(node)
    if (at === undefined || !isRegular(at)) return false
    return textDeclaredAs(declarationsOf(read.derived, ownKinds), at.node, SLEEPING_TYPE)?.trim() === "on"
  }
  return {
    seen: (reading) => {
      read = reading
      if (reading === null) {
        held = NO_AGENTS
        declaredKeys = claimedOnly()
        return
      }
      const declarations = declarationsOf(reading.derived, ownKinds)
      held = rosterIn(reading)
      declaredKeys = new Map(OWN_WORDS.map((word) => {
        const declared = keysDeclaredAs(declarations, word)
        return [word, declared.length === 0 ? [word] : declared]
      }))
    },
    agentAt: (to) =>
      held.find((one) => one.engine === to.agent && one.session === to.session) ?? null,
    nodeAt: (item) => held.find((one) => one.id === item) ?? null,
    seatableAt: (item) => {
      if (read === null) return false
      const at = itemOf(item)
      return at.kind === "node"
        ? seatableIn(read.derived, at.id)
        : seatableNote(read.set, read.claims, at.path)
    },
    nodes: () => held,
    reading: () => read?.derived ?? null,
    key: () => keyOf(SESSION_TYPE),
    keys: () => keysOf(SESSION_TYPE),
    sleptKey: () => keyOf(SLEPT_TYPE),
    sleptKeys: () => keysOf(SLEPT_TYPE),
    sleptAt: (node) => {
      if (read === null) return null
      const at = read.derived.byId.get(node)
      if (at === undefined || !isRegular(at)) return null
      return textDeclaredAs(declarationsOf(read.derived, ownKinds), at.node, SLEPT_TYPE) ?? null
    },
    sleepKey: () => keyOf(SLEEPING_TYPE),
    sleepKeys: () => keysOf(SLEEPING_TYPE),
    opensKey: () => keyOf(OPENS_TYPE),
    opensKeys: () => keysOf(OPENS_TYPE),
    sleeps: sleeping,
    nearestAt: nearest,
    rowsWith: (overheard, live, sleep) => joined(held, overheard, live).map(row => {
      const located = read?.derived.byId.get(row.id)
      const changed = located !== undefined && isRegular(located) ? located.node.changed : undefined
      return {
        ...row,
        sleeps: sleeping(row.id),
        sleep: sleep?.(row.id) ?? null,
        ...(changed === undefined ? {} : { changed }),
      }
    }),
  }
}

export const joined = (
  agents: NodeAgents,
  overheard: ReadonlyArray<Overheard>,
  live: ReadonlyMap<string, LiveSession> = new Map(),
): ReadonlyArray<Omit<Agents[number], "sleeps" | "sleep">> => {
  if (agents.length === 0) return NO_AGENT_ROSTER
  return agents.map((agent) => {
    const heard = agent.session === null
      ? undefined
      : overheard.find((row) => row.agent === agent.engine && row.session === agent.session)
    return {
      ...agent,
      standing: standingOf(agent, live.get(agent.id)),
      ...(live.get(agent.id)?.since === undefined ? {} : { since: live.get(agent.id)!.since }),
      waiting: live.get(agent.id)?.sleep === true ? 0 : live.get(agent.id)?.asking ?? 0,
      ...(live.get(agent.id)?.unopened === true ? { unopened: true } : {}),
      said: heard?.said ?? null,
      seen: heard?.seen ?? null,
    }
  })
}

const standingOf = (
  agent: NodeAgent,
  live: LiveSession | undefined,
): Agents[number]["standing"] => {
  if (agent.session === null) return live?.unopened === true ? "needs-you" : "unbound"
  if (live === undefined) return "asleep"
  if (live.status === "off" || live.status === "gone") return "gone"
  if (live.status === "booting") return "waking"
  if (live.sleep === true && live.status === "thinking") return "working"
  if (live.asking > 0) return "needs-you"
  return live.status === "thinking" ? "working" : "idle"
}
