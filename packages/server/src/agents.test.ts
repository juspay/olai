/**
 * THE ROSTER, ASSEMBLED — what the join does with two halves that can disagree.
 *
 * Neither half is asserted here: which nodes carry an `agent` property is
 * `@olai/format`'s suite, and what a binding file says is `@olai/chat`'s. What
 * is pinned is the SEAM — which half leads, what an unbound node says, and what
 * becomes of a binding whose node has gone. That last one is not a corner case
 * in this phase: bindings are written by hand, so a node id that does not exist
 * is a typo somebody will make on their first one.
 */

import { expect, test } from "bun:test"

import type { Bound } from "@olai/chat"
import type { NodeAgents } from "@olai/format"

import { joined } from "./agents.ts"

const AGENTS: NodeAgents = [
  { id: "spaces", file: "lanes.olai", title: "Xyne Spaces", engine: "grok", memory: 14 },
  { id: "odu", file: "lanes.olai", title: "Odu", engine: "opus", memory: 3 },
]

const BOUND: Bound = {
  node: "spaces",
  agent: "claude",
  session: "sess-1",
  taught: true,
  said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
}

test("the VAULT leads: every node agent is a row, bound or not", () => {
  expect(joined(AGENTS, [BOUND])).toEqual([
    {
      id: "spaces",
      file: "lanes.olai",
      title: "Xyne Spaces",
      engine: "grok",
      memory: 14,
      session: { agent: "claude", id: "sess-1" },
      said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
      taught: true,
    },
    {
      id: "odu",
      file: "lanes.olai",
      title: "Odu",
      engine: "opus",
      memory: 3,
      session: null,
      said: null,
      taught: false,
    },
  ])
})

test("a binding whose node has gone is not a row — never a phantom to press", () => {
  const stale: Bound = { node: "trashed", agent: "claude", session: "sess-9" }
  expect(joined(AGENTS, [stale]).map((row) => row.id)).toEqual(["spaces", "odu"])
  expect(joined(AGENTS, [stale]).every((row) => row.session === null)).toBe(true)
})

test("no bindings at all is every node agent unbound, which is the ordinary state", () => {
  const rows = joined(AGENTS, [])
  expect(rows).toHaveLength(2)
  expect(rows.every((row) => row.session === null && row.said === null && !row.taught)).toBe(true)
})

test("a directory with no node agent has no roster, whatever is bound", () => {
  expect(joined([], [BOUND])).toEqual([])
})

test("a node bound twice takes the FIRST row — the second is the mistake", () => {
  const again: Bound = { node: "spaces", agent: "opencode", session: "sess-2" }
  expect(joined(AGENTS, [BOUND, again])[0]?.session).toEqual({ agent: "claude", id: "sess-1" })
})

test("the two facts olai writes back travel as null rather than as absent keys", () => {
  const bare: Bound = { node: "spaces", agent: "claude", session: "sess-1" }
  const row = joined(AGENTS, [bare])[0]
  expect(row?.said).toBe(null)
  expect(row?.taught).toBe(false)
})
