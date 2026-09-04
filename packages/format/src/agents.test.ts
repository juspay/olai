/**
 * THE ROSTER, READ OFF THE SET — the query `prop:<the declared key>`, the rules
 * about which rows it answers with, and the colon that splits one value in two.
 *
 * What is pinned here is the whole of what a VAULT says about a node agent, and
 * since the human's ruling of 2026-09-02 that includes WHICH CONVERSATION it is
 * talking through. What a session is DOING — working, asleep, what it last
 * uttered — is a per-machine fact this reading has never seen, and is asserted
 * where it is kept (`olai-plugin-chat`'s `sessions.test.ts`) and where it is joined
 * (that plugin's `server/agents.test.ts`).
 *
 * ## THE KIND IS MADE UP HERE, and it has to be
 *
 * The real word is `chat-agent-session`, composed by the registry out of a
 * plugin's name — and this package spells no plugin's word, in a bench any more
 * than in a source, because the reading under test is the one that took the key
 * as data precisely so it would not have to. So the vocabulary below contributes
 * `agent-session` and claims that same key: a made-up kind whose claimed key is
 * the bare word, which is the shortest thing that exercises both layers of
 * {@link withClaims} without borrowing anybody's name.
 *
 * WHICH SPELLING A REAL VAULT CARRIES IS ASSERTED WHERE THE WORD IS — the
 * claimed `chat-agent-session`, and the one declaration row that moves the kind
 * back onto the bare key, are `olai-plugin-chat`'s `server/agents.test.ts`. What
 * is held here is that the reading follows the DECLARATION rather than any
 * particular string, which is the two cases at the bottom of this file.
 */

import { expect, test } from "bun:test"

import { agentsIn, memoryOf, NO_AGENTS, sameAgents, sessionIn, sessionValue } from "./agents.ts"
import { derive, type Derived } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import { declarationsOf, type KindVocabulary, NO_KINDS } from "./typing.ts"

/** The made-up kind this file's vault declares, and the key it claims. See the
 *  header for why neither is the real word. */
const SESSION_KIND = "agent-session"
const KINDS: KindVocabulary = (() => {
  const own = new Map([[SESSION_KIND, {
    kind: SESSION_KIND,
    takes: "an engine, optionally `:` and a session id",
    admits: (value: string) => sessionIn(value) !== null,
    claims: SESSION_KIND,
  }]])
  return { built: own, enabled: own }
})()

const LANES = [
  `{"id":"lanes","ord":"a0","title":"the lanes"}`,
  `{"id":"spaces","parent":"lanes","ord":"a0","title":"Xyne Spaces — the org OS","custom":{"agent-session":"grok:0f3c8d21","repo":"xyne-spaces"}}`,
  `{"id":"mirror-pr","parent":"spaces","ord":"a0","title":"PR: the fleet reports in","custom":{"agent-session":"grok"}}`,
  `{"id":"steer","parent":"spaces","ord":"a1","title":"PR: the channel steers"}`,
  `{"id":"quiet","parent":"lanes","ord":"a1","title":"a lane with nothing on it"}`,
].join("\n")

const setWith = (files: Record<string, string>) => derive(recordsOf(setOf(files)))

/** The reading under test, with the two arguments a caller supplies folded in
 *  once: the vault's declarations — this file's vocabulary claimed and any
 *  `Properties.olai` row on top — and the kind's word. */
const rosterIn = (derived: Derived, kinds: KindVocabulary = KINDS) =>
  agentsIn(derived, declarationsOf(derived, kinds), SESSION_KIND)

// ── which rows the query answers with ──────────────────────────────────

test("one row per node carrying an `agent-session` property, in corpus order", () => {
  expect(rosterIn(setWith({ "lanes.olai": LANES }))).toEqual([
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
  expect(rosterIn(setWith({ "garden.olai": bare }))).toEqual(NO_AGENTS)
})

test("the engine travels VERBATIM — never resolved against this machine", () => {
  const odd = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":"an-engine-nobody-here-has"}}`
  expect(rosterIn(setWith({ "a.olai": odd }))[0]?.engine).toBe("an-engine-nobody-here-has")
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
  expect(rosterIn(setWith({ "_olai/Trash.olai": held }))).toEqual(NO_AGENTS)
  expect(rosterIn(setWith({ "Archive.olai": held }))).toEqual(NO_AGENTS)
})

test("an empty value is not an association", () => {
  const empty = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":""}}`
  expect(rosterIn(setWith({ "a.olai": empty }))).toEqual(NO_AGENTS)
})

test("a value that names a session and no engine is not one either", () => {
  const half = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":":sess-1"}}`
  expect(rosterIn(setWith({ "a.olai": half }))).toEqual(NO_AGENTS)
})

test("a LIST-valued `agent-session` says nothing rather than naming its first entry", () => {
  const listed = `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":["claude","grok"]}}`
  expect(rosterIn(setWith({ "a.olai": listed }))).toEqual(NO_AGENTS)
})

test("a mirror carries no properties, so it is never a row of its own", () => {
  const files = {
    "a.olai": `{"id":"n","ord":"a0","title":"n","custom":{"agent-session":"claude"}}`,
    "b.olai": `{"id":"m","ord":"a0","mirror":"n"}`,
  }
  // One row, and it is the node — the placement standing for it is not a second
  // node agent, however many places the node is drawn in.
  expect(rosterIn(setWith(files)).map((one) => one.id)).toEqual(["n"])
})

test("a DONE node keeps its row: the roster is the query, and nothing else", () => {
  const done =
    `{"id":"n","ord":"a0","title":"a finished lane","done":"2026-08-24","custom":{"agent-session":"claude"}}`
  expect(rosterIn(setWith({ "a.olai": done })).map((one) => one.id)).toEqual(["n"])
})

// ── the memory, which is the subtree ───────────────────────────────────

test("memory counts every descendant, at any depth, and not the node itself", () => {
  const deep = [
    `{"id":"top","ord":"a0","title":"top","custom":{"agent-session":"claude"}}`,
    `{"id":"one","parent":"top","ord":"a0","title":"one"}`,
    `{"id":"two","parent":"one","ord":"a0","title":"two"}`,
    `{"id":"three","parent":"two","ord":"a0","title":"three"}`,
  ].join("\n")
  expect(rosterIn(setWith({ "a.olai": deep }))[0]?.memory).toBe(3)
})

// ── and what keeps a quiet revision off the wire ───────────────────────

test("two readings of the same set say the same thing", () => {
  const one = rosterIn(setWith({ "lanes.olai": LANES }))
  const again = rosterIn(setWith({ "lanes.olai": LANES }))
  expect(one).not.toBe(again)
  expect(sameAgents(one, again)).toBe(true)
})

test("a RETITLED node agent is a reading that differs — the roster is live", () => {
  const renamed = LANES.replace("Xyne Spaces — the org OS", "Spaces")
  expect(sameAgents(
    rosterIn(setWith({ "lanes.olai": LANES })),
    rosterIn(setWith({ "lanes.olai": renamed })),
  )).toBe(false)
})

test("a row GROWING its subtree is a reading that differs — memory is live", () => {
  const grown = `${LANES}\n{"id":"new","parent":"spaces","ord":"a2","title":"one more"}`
  expect(sameAgents(
    rosterIn(setWith({ "lanes.olai": LANES })),
    rosterIn(setWith({ "lanes.olai": grown })),
  )).toBe(false)
})

test("how big a memory is, in words — and one row is not `1 rows`", () => {
  expect(memoryOf({ memory: 14 })).toBe("14 rows")
  expect(memoryOf({ memory: 1 })).toBe("1 row")
  expect(memoryOf({ memory: 0 })).toBe("0 rows")
})

// ── and the two layers the key actually comes from ─────────────────────

/** A vault that declares the kind on a column of its own name, beside the key
 *  the kind claims. Both are declarations and this reading knows no difference
 *  between them. */
const MOVED = {
  "_olai/Properties.olai": `{"id":"prop-talks","ord":"a0","title":"talks-to","custom":{"type":"agent-session"}}`,
  "board.olai": [
    `{"id":"mine","ord":"a0","title":"my own column","custom":{"talks-to":"grok:s-1"}}`,
    `{"id":"claimed","ord":"a1","title":"the claimed key","custom":{"agent-session":"opus"}}`,
  ].join("\n"),
}

test("a vault ROW puts the roster on a column of its own name", () => {
  // Both rows, because both keys are declared the kind — the vault's own and
  // the one the kind claims. A reading that had matched on a key's SPELLING
  // would have found only the second.
  expect(rosterIn(setWith(MOVED)).map((one) => [one.id, one.engine])).toEqual([
    ["mine", "grok"],
    ["claimed", "opus"],
  ])
})

test("...and a row declaring the claimed key something else takes those rows away", () => {
  // THE VAULT WINS, in both directions (`./typing.ts`'s `withClaims`): a board
  // that says its `agent-session` column is prose has said what it means, and a
  // default that argued back would be the plugin overruling the person.
  const said = {
    "_olai/Properties.olai":
      `{"id":"prop-session","ord":"a0","title":"agent-session","custom":{"type":"text"}}`,
    "lanes.olai": LANES,
  }
  expect(rosterIn(setWith(said))).toEqual(NO_AGENTS)
})

test("a serve running no such kind reads no node agent at all", () => {
  // The licence, and the reason it is asked before the loop: a vocabulary with
  // nothing in it declares no key, so a vault full of `agent-session` values is
  // the plain text every vault that never heard of the plugin already holds.
  expect(rosterIn(setWith({ "lanes.olai": LANES }), NO_KINDS)).toEqual(NO_AGENTS)
})
