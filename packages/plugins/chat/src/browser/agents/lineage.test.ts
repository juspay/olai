/**
 * WHOSE CONVERSATIONS THESE ARE — the chain a node agent claims, and what is
 * left over.
 *
 * The claim these cases hold is the one migration turns on: assigning a chat
 * claims the whole `/clear` chain behind it, so a node agent's *past sessions*
 * is populated the moment it is given a current one — and every conversation
 * that chain reaches leaves the Unassigned list in the same gesture.
 */

import { expect, test } from "bun:test"

import type { Agents, SessionInfo } from "olai-plugin-chat/wire"
import { claimedIn, pastOf, unassignedIn } from "./lineage.ts"

/** One stored conversation. The fields a lineage reads are the id, the agent
 *  and the link; the rest is what a row DRAWS and is spelled once here. */
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

/** A `/clear` chain of three, newest last: `first` → `second` → `third`. */
const CHAIN: ReadonlyArray<SessionInfo> = [
  chat("third"),
  chat("second", { supersededBy: "third" }),
  chat("first", { supersededBy: "second" }),
]

const bound = (session: string | null, engine = "claude"): Agents => [{
  id: "spaces",
  file: "lanes.olai",
  title: "Xyne Spaces",
  engine,
  memory: 14,
  session,
  standing: session === null ? "unbound" : "asleep",
  waiting: 0,
  said: null,
}]

// ── the chain behind a conversation ────────────────────────────────────

test("past sessions are the chain walked backwards, newest first", () => {
  expect(pastOf(CHAIN, "claude", "third").map((row) => row.id)).toEqual(["second", "first"])
})

test("the conversation itself is not one of its own past sessions", () => {
  // What "past" means, and what the header's count says: an agent that has had
  // one conversation and cleared it once has ONE past session, not two.
  expect(pastOf(CHAIN, "claude", "third")).toHaveLength(2)
  expect(pastOf(CHAIN, "claude", "first")).toEqual([])
})

test("a session the list does not hold still has its predecessors", () => {
  // The conversation opened a moment ago is not in an answer taken before it,
  // and the walk is over links pointing AT an id rather than over a row.
  const listed = [chat("second", { supersededBy: "fresh" }), chat("first")]
  expect(pastOf(listed, "claude", "fresh").map((row) => row.id)).toEqual(["second"])
})

test("a link is followed only inside the agent that wrote it", () => {
  // A session id is one agent's own space. An opencode row naming a claude id
  // is not this chain's predecessor, however the strings compare.
  const mixed = [chat("second", { agent: "opencode", supersededBy: "third" }), ...CHAIN]
  expect(pastOf(mixed, "opencode", "third").map((row) => row.id)).toEqual(["second"])
})

test("a cycle ends the walk rather than spinning", () => {
  // Nothing should be able to write one — a supersession points at a
  // conversation minted after it — but the links come off a wire and off a
  // state file, and a shorter history is the safe way to be wrong.
  const looped = [
    chat("a", { supersededBy: "b" }),
    chat("b", { supersededBy: "a" }),
  ]
  expect(pastOf(looped, "claude", "a").map((row) => row.id)).toEqual(["b"])
})

// ── what a node claims, and what is left ───────────────────────────────

test("assigning the newest conversation claims the whole chain behind it", () => {
  expect([...claimedIn(CHAIN, bound("third"))]).toEqual([
    "claude/third",
    "claude/second",
    "claude/first",
  ])
  expect(unassignedIn(CHAIN, bound("third"))).toEqual([])
})

test("... and claims nothing that came AFTER the session it names", () => {
  // The property names `second`, so `third` — the conversation that replaced
  // it — is nobody's: a node agent claims its history, never its future.
  expect(unassignedIn(CHAIN, bound("second")).map((row) => row.id)).toEqual(["third"])
})

test("a node agent with no session claims nothing at all", () => {
  // Which is what makes Unassigned the doorway: an unbound node agent has no
  // history, so every chat is still there to be given to it.
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
