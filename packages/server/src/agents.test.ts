/**
 * THE ROSTER, ASSEMBLED — what the join does with two halves that can disagree.
 *
 * Neither half is asserted here: which nodes carry an `agent-session` property,
 * and what its two halves are, is `@olai/format`'s suite; what a machine's own
 * record says is `@olai/chat`'s. What is pinned is the SEAM — that the vault
 * leads, that the line olai heard is matched on the PAIR, and what a node agent
 * nobody has started a session for says.
 */

import { expect, test } from "bun:test"

import type { Overheard } from "@olai/chat"
import { derive, type NodeAgents } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"

import { joined, roster } from "./agents.ts"

const AGENTS: NodeAgents = [
  {
    id: "spaces",
    file: "lanes.olai",
    title: "Xyne Spaces",
    engine: "grok",
    session: "sess-1",
    memory: 14,
  },
  { id: "odu", file: "lanes.olai", title: "Odu", engine: "opus", session: null, memory: 3 },
]

const HEARD: Overheard = {
  agent: "grok",
  session: "sess-1",
  taught: true,
  said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
}

test("the VAULT leads: every node agent is a row, with a session or without one", () => {
  expect(joined(AGENTS, [HEARD])).toEqual([
    {
      id: "spaces",
      file: "lanes.olai",
      title: "Xyne Spaces",
      engine: "grok",
      session: "sess-1",
      memory: 14,
      standing: "asleep",
      waiting: 0,
      said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
    },
    {
      id: "odu",
      file: "lanes.olai",
      title: "Odu",
      engine: "opus",
      session: null,
      memory: 3,
      standing: "unbound",
      waiting: 0,
      said: null,
    },
  ])
})

test("a line overheard in a conversation no property names is not a row", () => {
  const elsewhere: Overheard = {
    agent: "claude",
    session: "sess-9",
    said: { text: "ci is green", at: "2026-09-01T17:00:00Z" },
  }
  expect(joined(AGENTS, [elsewhere]).map((row) => row.id)).toEqual(["spaces", "odu"])
  expect(joined(AGENTS, [elsewhere]).every((row) => row.said === null)).toBe(true)
})

test("the PAIR is the key: the same session under another engine is not this line", () => {
  const wrong: Overheard = { ...HEARD, agent: "claude" }
  expect(joined(AGENTS, [wrong])[0]?.said).toBe(null)
})

test("nothing overheard at all is every row with no line, which is a fresh machine", () => {
  const rows = joined(AGENTS, [])
  expect(rows).toHaveLength(2)
  expect(rows.every((row) => row.said === null)).toBe(true)
})

test("a directory with no node agent has no roster, whatever was overheard", () => {
  expect(joined([], [HEARD])).toEqual([])
})

test("two node sessions are live at once, each with its own standing and questions", () => {
  const live = new Map([
    ["spaces", { status: "thinking" as const, asking: 0 }],
    ["odu", { status: "thinking" as const, asking: 2 }],
  ])
  const rows = joined([
    AGENTS[0]!,
    { ...AGENTS[1]!, session: "sess-2" },
  ], [], live)
  expect(rows.map((row) => [row.standing, row.waiting])).toEqual([
    ["working", 0],
    ["needs-you", 2],
  ])
})

test("a reaped node scope reads asleep while its binding remains durable", () => {
  expect(joined(AGENTS, [], new Map())[0]?.standing).toBe("asleep")
})

test("the fact olai writes back travels as null rather than as an absent key", () => {
  const bare: Overheard = { agent: "grok", session: "sess-1" }
  expect(joined(AGENTS, [bare])[0]?.said).toBe(null)
})

// ── the reading that points the other way ──────────────────────────────

/** One revision of a board with two node agents on it, one of them bound. */
const SEEN = derive(recordsOf(setOf({
  "lanes.olai": [
    `{"id":"spaces","ord":"a0","title":"Xyne Spaces","custom":{"agent-session":"grok:sess-1"}}`,
    `{"id":"odu","ord":"a1","title":"Odu","custom":{"agent-session":"opus"}}`,
  ].join("\n"),
})))

test("a conversation is answered with the node agent whose property names it", () => {
  const carrier = roster()
  carrier.seen(SEEN)
  expect(carrier.agentAt({ agent: "grok", session: "sess-1" })?.id).toBe("spaces")
})

test("... and the PAIR again: the right session under the wrong engine is nobody's", () => {
  const carrier = roster()
  carrier.seen(SEEN)
  expect(carrier.agentAt({ agent: "claude", session: "sess-1" })).toBeNull()
})

test("a conversation no property names is nobody's, which is nearly every one", () => {
  const carrier = roster()
  carrier.seen(SEEN)
  expect(carrier.agentAt({ agent: "grok", session: "sess-9" })).toBeNull()
})

test("the nearest node agent above is named from the current vault reading", () => {
  const nested = derive(recordsOf(setOf({
    "lanes.olai": [
      `{"id":"root","ord":"a0","title":"Root","custom":{"agent-session":"claude:r"}}`,
      `{"id":"child","parent":"root","ord":"a0","title":"Child","custom":{"agent-session":"claude:c"}}`,
      `{"id":"leaf","parent":"child","ord":"a0","title":"Leaf","custom":{"agent-session":"claude:l"}}`,
    ].join("\n"),
  })))
  const carrier = roster()
  carrier.seen(nested)
  expect(carrier.above("leaf")).toBe("“Child” (`child`)")
  expect(carrier.above("root")).toBeNull()
})

test("a store that has never loaded has no node agents rather than an unknown number", () => {
  const carrier = roster()
  carrier.seen(null)
  expect(carrier.rowsWith([])).toEqual([])
  expect(carrier.agentAt({ agent: "grok", session: "sess-1" })).toBeNull()
})
