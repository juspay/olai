/**
 * THE ROSTER, READ OFF THE SET — the query `prop:agent-session`, the rules
 * about which rows it answers with, and the colon that splits one value in two.
 *
 * What is pinned here is the whole of what a VAULT says about a node agent, and
 * since the human's ruling of 2026-09-02 that includes WHICH CONVERSATION it is
 * talking through. What a session is DOING — working, asleep, what it last
 * uttered — is a per-machine fact this reading has never seen, and is asserted
 * where it is kept (`@olai/chat`'s `sessions.test.ts`) and where it is joined
 * (`@olai/web`'s `agents/roster.test.ts`).
 */

import { expect, test } from "bun:test"

import { agentsOf, memoryOf, NO_AGENTS, sameAgents, sessionIn, sessionValue } from "./agents.ts"
import { derive } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"

const LANES = [
  `{"id":"lanes","ord":"a0","title":"the lanes"}`,
  `{"id":"spaces","parent":"lanes","ord":"a0","title":"Xyne Spaces — the org OS","custom":{"agent-session":"grok:0f3c8d21","repo":"xyne-spaces"}}`,
  `{"id":"mirror-pr","parent":"spaces","ord":"a0","title":"PR: the fleet reports in","custom":{"agent-session":"grok"}}`,
  `{"id":"steer","parent":"spaces","ord":"a1","title":"PR: the channel steers"}`,
  `{"id":"quiet","parent":"lanes","ord":"a1","title":"a lane with nothing on it"}`,
].join("\n")

const setWith = (files: Record<string, string>) => derive(recordsOf(setOf(files)))

// ── which rows the query answers with ──────────────────────────────────

test("one row per node carrying an `agent-session` property, in corpus order", () => {
  expect(agentsOf(setWith({ "lanes.olai": LANES }))).toEqual([
    {
      id: "spaces",
      file: "lanes.olai",
      title: "Xyne Spaces — the org OS",
      engine: "grok",
      session: "0f3c8d21",
      // Two descendants: the PR row and the steer row.
      memory: 2,
    },
    {
      id: "mirror-pr",
      file: "lanes.olai",
      title: "PR: the fleet reports in",
      engine: "grok",
      // The engine half alone: a node agent nobody has started a session for.
      session: null,
      memory: 0,
    },
  ])
})

test("a directory with no node agent in it answers with nothing", () => {
  const bare = `{"id":"garden","ord":"a0","title":"garden"}`
  expect(agentsOf(setWith({ "garden.olai": bare }))).toEqual(NO_AGENTS)
})

test("the engine travels VERBATIM — never resolved against this machine", () => {
  const odd = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":"an-engine-nobody-here-has"}}`
  expect(agentsOf(setWith({ "a.olai": odd }))[0]?.engine).toBe("an-engine-nobody-here-has")
})

// ── one value, read and written ────────────────────────────────────────

test("the engine alone is a node agent with no session", () => {
  expect(sessionIn("claude")).toEqual({ engine: "claude", session: null })
})

test("the FIRST colon splits, so a session id may carry its own", () => {
  expect(sessionIn("claude:acp:0f3c:8d21")).toEqual({
    engine: "claude",
    session: "acp:0f3c:8d21",
  })
})

test("a trailing colon is an engine with no session — a person mid-edit", () => {
  expect(sessionIn("claude:")).toEqual({ engine: "claude", session: null })
})

test("a value naming no engine names no node agent", () => {
  expect(sessionIn("")).toBeNull()
  expect(sessionIn(":sess-1")).toBeNull()
})

test("what a writer composes is what this reads back", () => {
  for (const [engine, session] of [["claude", null], ["claude", "a:b"]] as const) {
    expect(sessionIn(sessionValue(engine, session))).toEqual({ engine, session })
  }
})

// ── and the rows it deliberately leaves out ────────────────────────────

test("what was put away is not on the roster — trash, and a leftover Archive", () => {
  const held = `{"id":"gone","ord":"a0","title":"a finished lane","custom":{"agent-session":"claude"}}`
  expect(agentsOf(setWith({ "_olai/Trash.olai": held }))).toEqual(NO_AGENTS)
  expect(agentsOf(setWith({ "Archive.olai": held }))).toEqual(NO_AGENTS)
})

test("an empty value is not an association", () => {
  const empty = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":""}}`
  expect(agentsOf(setWith({ "a.olai": empty }))).toEqual(NO_AGENTS)
})

test("a value that names a session and no engine is not one either", () => {
  const half = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":":sess-1"}}`
  expect(agentsOf(setWith({ "a.olai": half }))).toEqual(NO_AGENTS)
})

test("a LIST-valued `agent-session` says nothing rather than naming its first entry", () => {
  const listed = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":["claude","grok"]}}`
  expect(agentsOf(setWith({ "a.olai": listed }))).toEqual(NO_AGENTS)
})

test("a mirror carries no properties, so it is never a row of its own", () => {
  const files = {
    "a.olai": `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":"claude"}}`,
    "b.olai": `{"id":"m","ord":"a0","mirror":"n"}`,
  }
  // One row, and it is the node — the placement standing for it is not a second
  // node agent, however many places the node is drawn in.
  expect(agentsOf(setWith(files)).map((one) => one.id)).toEqual(["n"])
})

test("a DONE node keeps its row: the roster is the query, and nothing else", () => {
  const done =
    `{"id":"n","ord":"a0","title":"a finished lane","done":"2026-08-24","custom":{"agent-session":"claude"}}`
  expect(agentsOf(setWith({ "a.olai": done })).map((one) => one.id)).toEqual(["n"])
})

// ── the memory, which is the subtree ───────────────────────────────────

test("memory counts every descendant, at any depth, and not the node itself", () => {
  const deep = [
    `{"id":"top","ord":"a0","title":"top","custom":{"agent-session":"claude"}}`,
    `{"id":"one","parent":"top","ord":"a0","title":"one"}`,
    `{"id":"two","parent":"one","ord":"a0","title":"two"}`,
    `{"id":"three","parent":"two","ord":"a0","title":"three"}`,
  ].join("\n")
  expect(agentsOf(setWith({ "a.olai": deep }))[0]?.memory).toBe(3)
})

// ── and what keeps a quiet revision off the wire ───────────────────────

test("two readings of the same set say the same thing", () => {
  const one = agentsOf(setWith({ "lanes.olai": LANES }))
  const again = agentsOf(setWith({ "lanes.olai": LANES }))
  expect(one).not.toBe(again)
  expect(sameAgents(one, again)).toBe(true)
})

test("a RETITLED node agent is a reading that differs — the roster is live", () => {
  const renamed = LANES.replace("Xyne Spaces — the org OS", "Spaces")
  expect(sameAgents(
    agentsOf(setWith({ "lanes.olai": LANES })),
    agentsOf(setWith({ "lanes.olai": renamed })),
  )).toBe(false)
})

test("a row GROWING its subtree is a reading that differs — memory is live", () => {
  const grown = `${LANES}\n{"id":"new","parent":"spaces","ord":"a2","title":"one more"}`
  expect(sameAgents(
    agentsOf(setWith({ "lanes.olai": LANES })),
    agentsOf(setWith({ "lanes.olai": grown })),
  )).toBe(false)
})

test("how big a memory is, in words — and one row is not `1 rows`", () => {
  expect(memoryOf({ memory: 14 })).toBe("14 rows")
  expect(memoryOf({ memory: 1 })).toBe("1 row")
  expect(memoryOf({ memory: 0 })).toBe("0 rows")
})
