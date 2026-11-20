import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import {
  type AgentItem,
  agentsIn,
  isNotePath,
  itemKey,
  itemOf,
  memoryOf,
  NO_AGENTS,
  nodeChatTitle,
  notesClaimed,
  notesIn,
  sameAgents,
  seatableNote,
  sessionIn,
  sessionValue,
} from "./agents.ts"
import { derive, type Derived } from "./derive.ts"
import { recordsOf, setOf } from "./fixtures.testlib.ts"
import type { OutlineSet } from "./set.ts"
import { declarationsOf, type KindVocabulary, NO_KINDS } from "./typing.ts"

const SESSION_KIND = "agent-session"
const OPENS_KIND = "agent-opens"
const KINDS: KindVocabulary = (() => {
  const own = new Map([
    [SESSION_KIND, {
      kind: SESSION_KIND,
      takes: "an engine, optionally `:` and a session id",
      admits: (value: string) => sessionIn(value) !== null,
      claims: SESSION_KIND,
    }],
    [OPENS_KIND, {
      kind: OPENS_KIND,
      takes: "`alone` or `beside`",
      admits: (value: string) => value === "alone" || value === "beside",
      claims: OPENS_KIND,
    }],
  ])
  return { built: own, enabled: own }
})()

const LANES = [
  `{"id":"lanes","ord":"a0","title":"the lanes"}`,
  `{"id":"spaces","parent":"lanes","ord":"a0","title":"Xyne Spaces — the org OS","custom":{"agent-session":"grok:0f3c8d21","repo":"xyne-spaces"}}`,
  `{"id":"mirror-pr","parent":"spaces","ord":"a0","title":"PR: the fleet reports in","custom":{"agent-session":"grok"}}`,
  `{"id":"steer","parent":"spaces","ord":"a1","title":"PR: the channel steers"}`,
  `{"id":"quiet","parent":"lanes","ord":"a1","title":"a lane with nothing on it"}`,
].join("\n")

const setWith = (files: Record<string, string>) => derive(TEST_CLAIMS, recordsOf(setOf(files)))

const rosterIn = (derived: Derived, kinds: KindVocabulary = KINDS) =>
  agentsIn(derived, declarationsOf(derived, kinds), SESSION_KIND)

test("one row per node carrying an `agent-session` property, in corpus order", () => {
  expect(rosterIn(setWith({ "lanes.olai": LANES }))).toEqual([
    {
      kind: "node",
      id: "spaces",
      file: "lanes.olai",
      title: "Xyne Spaces — the org OS",
      engine: "grok",
      session: "0f3c8d21",
      memory: 2,
      beside: false,
    },
    {
      kind: "node",
      id: "mirror-pr",
      file: "lanes.olai",
      title: "PR: the fleet reports in",
      engine: "grok",
      session: null,
      memory: 0,
      beside: false,
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
  expect(rosterIn(setWith(files)).map((one) => one.id)).toEqual(["n"])
})

test("a DONE node keeps its row: the roster is the query, and nothing else", () => {
  const done =
    `{"id":"n","ord":"a0","title":"a finished lane","done":"2026-08-24","custom":{"agent-session":"claude"}}`
  expect(rosterIn(setWith({ "a.olai": done })).map((one) => one.id)).toEqual(["n"])
})

test("memory counts every descendant, at any depth, and not the node itself", () => {
  const deep = [
    `{"id":"top","ord":"a0","title":"top","custom":{"agent-session":"claude"}}`,
    `{"id":"one","parent":"top","ord":"a0","title":"one"}`,
    `{"id":"two","parent":"one","ord":"a0","title":"two"}`,
    `{"id":"three","parent":"two","ord":"a0","title":"three"}`,
  ].join("\n")
  expect(rosterIn(setWith({ "a.olai": deep }))[0]?.memory).toBe(3)
})

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

test("a row titled as one markdown link is named by its LABEL, not its address", () => {
  const filed = `{"id":"house-row","ord":"a0","title":"[house](/house.olai)","custom":{"agent-session":"claude:sess-7"}}`
  expect(rosterIn(setWith({ "chats.olai": filed }))[0]?.title).toBe("house")
  expect(nodeChatTitle("[plan](/notes/plan.md)")).toBe("plan")
  expect(nodeChatTitle("  [the kitchen](/#herbs)  ")).toBe("the kitchen")
})

test("...and every other title is itself — prose, a bare address, a blank label", () => {
  expect(nodeChatTitle("kitchen remodel")).toBe("kitchen remodel")
  expect(nodeChatTitle("/house.olai")).toBe("/house.olai")
  expect(nodeChatTitle("[](/house.olai)")).toBe("[](/house.olai)")
  expect(nodeChatTitle("see [house](/house.olai) first")).toBe("see [house](/house.olai) first")
})

test("a table claiming a kind a note is written in says so; one with only outlines does not", () => {
  expect(notesClaimed(TEST_CLAIMS.byKind.values())).toBe(true)
  expect(notesClaimed([...TEST_CLAIMS.byKind.values()].filter((claim) => claim.holds === "nodes"))).toBe(false)
  expect(notesClaimed([])).toBe(false)
})

test("a half of somebody's plugin is not a note, however its text is kept", () => {
  const opaque = [...TEST_CLAIMS.byKind.values()].filter((claim) => claim.opaque === true)
  expect(opaque.length).toBeGreaterThan(0)
  expect(notesClaimed(opaque)).toBe(false)
})

test("how big a memory is, in words — and one row is not `1 rows`", () => {
  expect(memoryOf({ memory: 14 })).toBe("14 rows")
  expect(memoryOf({ memory: 1 })).toBe("1 row")
  expect(memoryOf({ memory: 0 })).toBe("0 rows")
})

const MOVED = {
  "_olai/Properties.olai": `{"id":"prop-talks","ord":"a0","title":"talks-to","custom":{"type":"agent-session"}}`,
  "board.olai": [
    `{"id":"mine","ord":"a0","title":"my own column","custom":{"talks-to":"grok:s-1"}}`,
    `{"id":"claimed","ord":"a1","title":"the claimed key","custom":{"agent-session":"opus"}}`,
  ].join("\n"),
}

test("a vault ROW puts the roster on a column of its own name", () => {
  expect(rosterIn(setWith(MOVED)).map((one) => [one.id, one.engine])).toEqual([
    ["mine", "grok"],
    ["claimed", "opus"],
  ])
})

test("...and a row declaring the claimed key something else takes those rows away", () => {
  const said = {
    "_olai/Properties.olai":
      `{"id":"prop-session","ord":"a0","title":"agent-session","custom":{"type":"text"}}`,
    "lanes.olai": LANES,
  }
  expect(rosterIn(setWith(said))).toEqual(NO_AGENTS)
})

test("a serve running no such kind reads no node agent at all", () => {
  expect(rosterIn(setWith({ "lanes.olai": LANES }), NO_KINDS)).toEqual(NO_AGENTS)
})

const notesOf = (notes: Record<string, string>, shown: ReadonlyArray<string> = []) => {
  const set = setOf({}, [...Object.entries(notes), ...shown])
  return notesIn(set, TEST_CLAIMS, declarationsOf(derive(TEST_CLAIMS, recordsOf(set)), KINDS), SESSION_KIND, OPENS_KIND)
}

const PLAN = "---\nagent-session: claude:a1\nagent-opens: beside\ntopic: kitchen\n---\n# Plan\n"

test("one row per note whose block carries a binding, in path order", () => {
  expect(notesOf({
    "notes/plan.md": PLAN,
    "notes/quiet.md": "a note nobody is talking to\n",
    "zz.md": "---\nagent-session: grok\n---\nhi\n",
  })).toEqual([
    {
      kind: "note",
      id: "/notes/plan.md",
      file: "notes/plan.md",
      title: "plan",
      engine: "claude",
      session: "a1",
      memory: 0,
      beside: true,
    },
    {
      kind: "note",
      id: "/zz.md",
      file: "zz.md",
      title: "zz",
      engine: "grok",
      session: null,
      memory: 0,
      beside: false,
    },
  ])
})

test("the switch opens a chat beside, and every other answer is alone", () => {
  const opens = (said: string | null) =>
    notesOf({ "plan.md": `---\nagent-session: claude${said === null ? "" : `\nagent-opens: ${said}`}\n---\n` })[0]?.beside
  expect(opens("beside")).toBe(true)
  expect(opens("alone")).toBe(false)
  expect(opens(null)).toBe(false)
  expect(opens("sideways")).toBe(false)
})

test("a note's binding follows the DECLARATION, like a node's", () => {
  const set = setOf({}, [["plan.md", PLAN]])
  expect(notesIn(set, TEST_CLAIMS, declarationsOf(derive(TEST_CLAIMS, recordsOf(set)), NO_KINDS), SESSION_KIND, OPENS_KIND))
    .toEqual(NO_AGENTS)
})

test("a block that names no engine names no chat", () => {
  expect(notesOf({
    "none.md": "---\nagent-session:\n---\n",
    "sessionless.md": "---\nagent-session: :a1\n---\n",
    "listed.md": "---\nagent-session: [claude, grok]\n---\n",
    "unclosed.md": "---\nagent-session: claude\n# Plan\n",
  })).toEqual(NO_AGENTS)
})

test("what olai only SHOWS is not a note, however its text opens", () => {
  expect(notesOf(
    { "plugins/swatch/server.ts": "---\nagent-session: claude\n---\n" },
    ["page.html", "photos/kitchen.png"],
  )).toEqual(NO_AGENTS)
})

test("a note can be seated at; a path the directory does not serve cannot", () => {
  const set = setOf({ "house.olai": `{"id":"house","ord":"a0","title":"House"}` }, [
    ["notes/plan.md", "# Plan\n"],
    ["plugins/swatch/server.ts", "export const swatch = 1\n"],
    "photos/kitchen.png",
  ])
  expect(seatableNote(set, TEST_CLAIMS, "notes/plan.md")).toBe(true)
  expect(seatableNote(set, TEST_CLAIMS, "notes/missing.md")).toBe(false)
  expect(seatableNote(set, TEST_CLAIMS, "photos/kitchen.png")).toBe(false)
  expect(seatableNote(set, TEST_CLAIMS, "plugins/swatch/server.ts")).toBe(false)
  expect(seatableNote(set, TEST_CLAIMS, "house.olai")).toBe(false)
})

test("a node is its own key and a note is its path, and neither reads as the other", () => {
  const items: ReadonlyArray<readonly [AgentItem, string]> = [
    [{ kind: "node", id: "a1b2c3" }, "a1b2c3"],
    [{ kind: "note", path: "notes/plan.md" }, "/notes/plan.md"],
    [{ kind: "note", path: "plan.md" }, "/plan.md"],
  ]
  for (const [item, key] of items) {
    expect(itemKey(item)).toBe(key)
    expect(itemOf(key)).toEqual(item)
  }
})

test("a note path is a kept prose body the claim table holds, and nothing else", () => {
  expect(isNotePath(TEST_CLAIMS, "notes/plan.md")).toBe(true)
  expect(isNotePath(TEST_CLAIMS, "notes/plan.markdown")).toBe(false)
  expect(isNotePath(TEST_CLAIMS, "photos/kitchen.png")).toBe(false)
  expect(isNotePath(TEST_CLAIMS, "house.olai")).toBe(false)
  expect(isNotePath(TEST_CLAIMS, "data/costs.csv")).toBe(false)
  expect(isNotePath(TEST_CLAIMS, "plan")).toBe(false)
  expect(isNotePath(TEST_CLAIMS, "plugins/timer/src/server.ts")).toBe(false)
})
