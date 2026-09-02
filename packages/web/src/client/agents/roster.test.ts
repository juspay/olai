/**
 * HOW A NODE AGENT STANDS — the join, and the seven answers it can give.
 *
 * The point of these cases is that the roster and the panel cannot come to
 * disagree: every standing but the three that are facts about the ROW is asked
 * of `../chat/busy.ts`, which is the same decision the header draws, so what is
 * pinned here is the precedence between the two halves rather than a second
 * copy of the panel's own.
 */

import { expect, test } from "bun:test"

import { CHAT_OFF, type Agents, type ChatState } from "@olai/surface"

import { rowsOf } from "./roster.ts"

const SPACES = {
  id: "spaces",
  file: "lanes.olai",
  title: "Xyne Spaces — the org OS",
  engine: "grok",
  memory: 14,
  session: "sess-1",
  said: { text: "the mirror lane is in flight", at: "2026-09-01T16:41:00Z" },
}
const ODU = { ...SPACES, id: "odu", title: "Odu — the CI family", session: null, said: null }

const roster: Agents = [SPACES, ODU]

/** The panel, in one of its states, with `bound` naming a node or nobody. */
const panel = (over: Partial<ChatState>): ChatState => ({ ...CHAT_OFF, ...over })

const standingOf = (agents: Agents, chat: ChatState, id: string) =>
  rowsOf(agents, chat).find((row) => row.id === id)?.standing

// ── the three that are facts about the ROW ─────────────────────────────

test("a node agent nobody has bound a session to is UNBOUND, not asleep", () => {
  expect(standingOf(roster, panel({ status: "idle" }), "odu")).toBe("unbound")
})

test("a bound agent that is not the open conversation is ASLEEP", () => {
  // The panel is in `spaces`' conversation; `odu`'s is on disk and has no
  // process. Bound, and asleep.
  const bound: Agents = [SPACES, { ...ODU, session: "sess-2" }]
  expect(standingOf(bound, panel({ status: "thinking", bound: "spaces" }), "odu")).toBe("asleep")
})

test("every row is asleep or unbound while the panel is in nobody's conversation", () => {
  const drawn = rowsOf(roster, panel({ status: "idle", bound: null }))
  expect(drawn.map((row) => row.standing)).toEqual(["asleep", "unbound"])
})

// ── and the four the panel decides ─────────────────────────────────────

test("the open conversation working is WORKING", () => {
  expect(standingOf(roster, panel({ status: "thinking", bound: "spaces" }), "spaces"))
    .toBe("working")
})

test("a turn stopped on a question is NEEDS-YOU, which outranks working", () => {
  // Both are true at once on the wire — `asking` is only ever nonzero while a
  // turn is in flight — and the roster must say the half that is somebody's
  // move, exactly as the header does.
  const asked = panel({ status: "thinking", asking: 2, bound: "spaces" })
  expect(standingOf(roster, asked, "spaces")).toBe("needs-you")
})

test("the agent starting is WAKING, which is not the same as ready", () => {
  expect(standingOf(roster, panel({ status: "booting", bound: "spaces" }), "spaces"))
    .toBe("waking")
})

test("the open conversation with nothing in flight is IDLE", () => {
  expect(standingOf(roster, panel({ status: "idle", bound: "spaces" }), "spaces")).toBe("idle")
})

test("an agent that is not running is GONE, and so is a panel with none configured", () => {
  expect(standingOf(roster, panel({ status: "gone", bound: "spaces" }), "spaces")).toBe("gone")
  expect(standingOf(roster, panel({ status: "off", bound: "spaces" }), "spaces")).toBe("gone")
})

// ── what is waiting on you ─────────────────────────────────────────────

test("the count is the OPEN conversation's questions, and zero everywhere else", () => {
  const asked = panel({ status: "thinking", asking: 2, bound: "spaces" })
  const drawn = rowsOf(roster, asked)
  expect(drawn.map((row) => row.waiting)).toEqual([2, 0])
})

test("a sleeping agent's row never wears the open conversation's count", () => {
  // The panel is asking two questions of `spaces`; `odu` is a different agent
  // and has nothing waiting, whatever the panel is doing.
  const bound: Agents = [SPACES, { ...ODU, session: "sess-2" }]
  const asked = panel({ status: "thinking", asking: 2, bound: "spaces" })
  expect(rowsOf(bound, asked).find((row) => row.id === "odu")?.waiting).toBe(0)
})

// ── and the vault's own facts, carried through ─────────────────────────

test("the rows are the roster's own, in its order, with its facts untouched", () => {
  const drawn = rowsOf(roster, panel({}))
  expect(drawn.map((row) => row.id)).toEqual(["spaces", "odu"])
  expect(drawn[0]?.title).toBe("Xyne Spaces — the org OS")
  expect(drawn[0]?.engine).toBe("grok")
  expect(drawn[0]?.said?.text).toBe("the mirror lane is in flight")
})

test("an empty roster draws nothing at all", () => {
  expect(rowsOf([], panel({ status: "idle" }))).toEqual([])
})
