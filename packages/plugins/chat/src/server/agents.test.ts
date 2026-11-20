import { expect, test } from "bun:test"

import type { Overheard } from "olai-plugin-chat"
import { type NodeAgents } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"

import { OPENS_TYPE, SESSION_TYPE } from "../kinds.ts"
import { joined, roster } from "./agents.ts"

const AGENTS: NodeAgents = [
  {
    kind: "node",
    id: "spaces",
    file: "lanes.olai",
    title: "Xyne Spaces",
    engine: "grok",
    session: "sess-1",
    memory: 14,
    beside: false,
  },
  { kind: "node", id: "odu", file: "lanes.olai", title: "Odu", engine: "opus", session: null, memory: 3, beside: false },
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
      kind: "node",
      beside: false,
      id: "spaces",
      file: "lanes.olai",
      title: "Xyne Spaces",
      engine: "grok",
      session: "sess-1",
      memory: 14,
      standing: "asleep",
      waiting: 0,
      said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
      seen: null,
    },
    {
      kind: "node",
      beside: false,
      id: "odu",
      file: "lanes.olai",
      title: "Odu",
      engine: "opus",
      session: null,
      memory: 3,
      standing: "unbound",
      waiting: 0,
      said: null,
      seen: null,
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
  expect(joined(AGENTS, [bare])[0]?.seen).toBe(null)
})

test("what a person has READ is joined on the PAIR, exactly as the line is", () => {
  const acknowledged: Overheard = { ...HEARD, seen: "2026-09-01T16:41:00Z" }
  const rows = joined(AGENTS, [acknowledged])
  expect(rows[0]?.seen).toBe("2026-09-01T16:41:00Z")
  expect(rows[1]?.seen).toBe(null)
  expect(joined(AGENTS, [{ ...acknowledged, agent: "claude" }])[0]?.seen).toBe(null)
})

const SEEN = readingOf(setOf({
  "lanes.olai": [
    `{"id":"spaces","ord":"a0","title":"Xyne Spaces","custom":{"chat-agent-session":"grok:sess-1"}}`,
    `{"id":"odu","ord":"a1","title":"Odu","custom":{"chat-agent-session":"opus"}}`,
  ].join("\n"),
}))

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

test("the nearest node agent at or above is named from the current vault reading", () => {
  const nested = readingOf(setOf({
    "lanes.olai": [
      `{"id":"root","ord":"a0","title":"Root","custom":{"chat-agent-session":"claude:r"}}`,
      `{"id":"child","parent":"root","ord":"a0","title":"Child","custom":{"chat-agent-session":"claude:c"}}`,
      `{"id":"leaf","parent":"child","ord":"a0","title":"Leaf","custom":{"chat-agent-session":"claude:l"}}`,
    ].join("\n"),
  }))
  const carrier = roster()
  carrier.seen(nested)
  expect(carrier.nearestAt("leaf", new Set(["root", "child"]))).toBe("child")
  expect(carrier.nearestAt("leaf", new Set(["root"]))).toBe("root")
  expect(carrier.nearestAt("root", new Set(["root", "child"]))).toBe("root")
})

test("a store that has never loaded has no node agents rather than an unknown number", () => {
  const carrier = roster()
  carrier.seen(null)
  expect(carrier.rowsWith([])).toEqual([])
  expect(carrier.agentAt({ agent: "grok", session: "sess-1" })).toBeNull()
  expect(carrier.key()).toBe(SESSION_TYPE)
})

test("a vault that has declared nothing wears the claimed key out of the box", () => {
  const carrier = roster()
  carrier.seen(SEEN)
  expect(carrier.nodes().map((one) => one.id)).toEqual(["spaces", "odu"])
  expect(carrier.key()).toBe(SESSION_TYPE)
  expect(carrier.keys()).toEqual([SESSION_TYPE])
})

test("...and a vault keeping its bindings under a word of its own says so in ONE row", () => {
  const migrated = readingOf(setOf({
    "_olai/Properties.olai":
      `{"id":"prop-agent-session","ord":"a0","title":"agent-session","custom":{"type":"chat-agent-session"}}`,
    "lanes.olai":
      `{"id":"spaces","ord":"a0","title":"Xyne Spaces","custom":{"agent-session":"grok:sess-1"}}`,
  }))
  const carrier = roster()
  carrier.seen(migrated)
  expect(carrier.nodeAt("spaces")?.session).toBe("sess-1")
  expect(carrier.key()).toBe("agent-session")
  expect([...carrier.keys()].sort()).toEqual(["agent-session", SESSION_TYPE].sort())
})

test("a board that declares the claimed key something else keeps no node agents", () => {
  const said = readingOf(setOf({
    "_olai/Properties.olai":
      `{"id":"prop-session","ord":"a0","title":"chat-agent-session","custom":{"type":"text"}}`,
    "lanes.olai":
      `{"id":"spaces","ord":"a0","title":"Xyne Spaces","custom":{"chat-agent-session":"grok:sess-1"}}`,
  }))
  const carrier = roster()
  carrier.seen(said)
  expect(carrier.nodes()).toEqual([])
})

test("a board whose bindings sit on a column nothing declares keeps no node agents", () => {
  const bare = readingOf(setOf({
    "lanes.olai": `{"id":"one","ord":"a0","title":"One","custom":{"agent-session":"claude:s-1"}}`,
  }))
  const carrier = roster()
  carrier.seen(bare)
  expect(carrier.nodes()).toEqual([])
  expect(carrier.keys()).toEqual([SESSION_TYPE])
})

test("the wire roster carries the current vault edit stamp for agents not yet heard", () => {
  const carrier = roster()
  const seen = (changed: string) => readingOf(setOf({ "one.olai": JSON.stringify({ id: "one", ord: "a0", title: "One", changed, custom: { "chat-agent-session": "engine" } }) }))
  carrier.seen(seen("2026-01-01T00:00:00Z"))
  expect(carrier.rowsWith([])[0]?.changed).toBe("2026-01-01T00:00:00Z")
  carrier.seen(seen("2026-02-01T00:00:00Z"))
  expect(carrier.rowsWith([])[0]?.changed).toBe("2026-02-01T00:00:00Z")
})

const BOTH = readingOf(setOf(
  {
    "lanes.olai": `{"id":"spaces","ord":"a0","title":"Xyne Spaces","custom":{"chat-agent-session":"grok:sess-1"}}`,
  },
  [
    ["notes/plan.md", "---\nchat-agent-session: claude:sess-2\nchat-opens: beside\n---\n\n# Plan\n"],
    ["notes/idle.md", "# Idle\n"],
  ],
))

test("the roster is the nodes and then the notes, each keyed by its item key", () => {
  const carrier = roster()
  carrier.seen(BOTH)
  expect(carrier.nodes().map((one) => [one.kind, one.id, one.title, one.beside])).toEqual([
    ["node", "spaces", "Xyne Spaces", false],
    ["note", "/notes/plan.md", "plan", true],
  ])
  expect(carrier.nodeAt("/notes/plan.md")?.engine).toBe("claude")
  expect(carrier.agentAt({ agent: "claude", session: "sess-2" })?.id).toBe("/notes/plan.md")
})

test("a note olai still holds can be seated on, and one it does not cannot", () => {
  const carrier = roster()
  carrier.seen(BOTH)
  expect(carrier.seatableAt("/notes/idle.md")).toBe(true)
  expect(carrier.seatableAt("/notes/gone.md")).toBe(false)
  expect(carrier.seatableAt("spaces")).toBe(true)
  expect(carrier.seatableAt("nobody")).toBe(false)
})

test("the opens switch is written under the word this kind claims until a board says otherwise", () => {
  const carrier = roster()
  carrier.seen(BOTH)
  expect(carrier.opensKey()).toBe(OPENS_TYPE)
  const migrated = readingOf(setOf({
    "_olai/Properties.olai":
      `{"id":"prop-opens","ord":"a0","title":"opens","custom":{"type":"chat-opens"}}`,
  }))
  carrier.seen(migrated)
  expect(carrier.opensKey()).toBe("opens")
})

test("a note is never tidied: it carries no sleep memo and no sleeping mark", () => {
  const carrier = roster()
  carrier.seen(BOTH)
  expect(carrier.sleeps("/notes/plan.md")).toBe(false)
  expect(carrier.sleptAt("/notes/plan.md")).toBeNull()
})
