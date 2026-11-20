import { expect, test } from "bun:test"

import type { Agents, SessionInfo } from "olai-plugin-chat/wire"
import { claimedIn, pastOf } from "../../lineage.ts"

const chat = (
  id: string,
  over: Partial<SessionInfo> = {},
): SessionInfo => ({
  id,
  agent: "claude",
  title: id,
  updatedAt: "2026-08-01T17:30:00.000Z",
  messageCount: 12,
  supersededBy: null,
  ...over,
})

const unassignedIn = (sessions: Parameters<typeof claimedIn>[0], agents: Parameters<typeof claimedIn>[1]) => {
  const held = claimedIn(sessions, agents)
  return sessions.filter(row => !held.has(`${row.agent}/${row.id}`))
}

const CHAIN: ReadonlyArray<SessionInfo> = [
  chat("third"),
  chat("second", { supersededBy: { agent: "claude", session: "third" } }),
  chat("first", { supersededBy: { agent: "claude", session: "second" } }),
]

const bound = (session: string | null, engine = "claude"): Agents => [{
  id: "spaces",
  kind: "node",
  beside: false,
  file: "lanes.olai",
  title: "Xyne Spaces",
  engine,
  memory: 14,
  session,
  standing: session === null ? "unbound" : "asleep",
  waiting: 0,
  said: null,
  seen: null,
  sleeps: false,
  sleep: null,
}]

test("past sessions are the chain walked backwards, newest first", () => {
  expect(pastOf(CHAIN, "claude", "third").map((row) => row.id)).toEqual(["second", "first"])
})

test("the conversation itself is not one of its own past sessions", () => {
  expect(pastOf(CHAIN, "claude", "third")).toHaveLength(2)
  expect(pastOf(CHAIN, "claude", "first")).toEqual([])
})

test("a session the list does not hold still has its predecessors", () => {
  const listed = [chat("second", { supersededBy: { agent: "claude", session: "fresh" } }), chat("first")]
  expect(pastOf(listed, "claude", "fresh").map((row) => row.id)).toEqual(["second"])
})

test("a link is followed only inside the agent that wrote it", () => {
  const mixed = [chat("second", { agent: "opencode", supersededBy: { agent: "opencode", session: "third" } }), ...CHAIN]
  expect(pastOf(mixed, "opencode", "third").map((row) => row.id)).toEqual(["second"])
})

test("a cycle ends the walk rather than spinning", () => {
  const looped = [
    chat("a", { supersededBy: { agent: "claude", session: "b" } }),
    chat("b", { supersededBy: { agent: "claude", session: "a" } }),
  ]
  expect(pastOf(looped, "claude", "a").map((row) => row.id)).toEqual(["b"])
})

test("a link walked from a fresh engine finds the chain the previous engine left", () => {
  const listed = [
    chat("codex-current", { agent: "codex" }),
    chat("claude-old", { supersededBy: { agent: "codex", session: "codex-current" } }),
  ]
  expect(pastOf(listed, "codex", "codex-current").map((row) => row.id)).toEqual(["claude-old"])
})

test("assigning the newest conversation claims the whole chain behind it", () => {
  expect([...claimedIn(CHAIN, bound("third"))]).toEqual([
    "claude/third",
    "claude/second",
    "claude/first",
  ])
  expect(unassignedIn(CHAIN, bound("third"))).toEqual([])
})

test("... and claims nothing that came AFTER the session it names", () => {
  expect(unassignedIn(CHAIN, bound("second")).map((row) => row.id)).toEqual(["third"])
})

test("a node agent with no session claims nothing at all", () => {
  expect([...claimedIn(CHAIN, bound(null))]).toEqual([])
  expect(unassignedIn(CHAIN, bound(null))).toHaveLength(3)
})

test("a node agent on another engine claims none of this agent's chats", () => {
  expect(unassignedIn(CHAIN, bound("third", "opencode"))).toHaveLength(3)
})

test("the unclaimed keep the listing's own order, newest first", () => {
  const listed = [chat("newest"), ...CHAIN, chat("oldest", { agent: "opencode" })]
  expect(unassignedIn(listed, bound("second")).map((row) => row.id))
    .toEqual(["newest", "third", "oldest"])
})
