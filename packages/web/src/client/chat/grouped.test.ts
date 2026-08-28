/**
 * How the chats list is arranged for a reader, over values.
 *
 * The rule has two edges and both are ways the list stops being usable: the
 * ORDER of the groups (which must not move because somebody sent a message) and
 * WHICH GROUPS EXIST (which must not include an agent with nothing under it).
 * Reaching either through a browser means two agents, two conversations and a
 * clock.
 */

import type { AgentChoice, SessionInfo } from "@olai/surface"
import { describe, expect, test } from "bun:test"

import { groupedByAgent, nameOf } from "./grouped.ts"

const CLAUDE: AgentChoice = { id: "claude", name: "Claude Code" }
const OPENCODE: AgentChoice = { id: "opencode", name: "opencode" }
/** The roster's own order, which is the order the agent picker offers. */
const ROSTER = [CLAUDE, OPENCODE]

const said = (agent: string, id: string, updatedAt: string | null): SessionInfo => ({
  id,
  agent,
  title: null,
  updatedAt,
  messageCount: null,
  supersededBy: null,
})

describe("grouping the chats list", () => {
  test("in the ROSTER's order, not the list's", () => {
    // The server answers newest-first across every agent, so the newest
    // conversation here is opencode's — and the groups still come out in the
    // order the picker offers agents in. Otherwise a whole group jumps to the
    // top because somebody sent one message, and the list a person learned the
    // shape of is a different shape every time they open it.
    const grouped = groupedByAgent(
      [
        said("opencode", "oc-new", "2026-08-22T12:00:00Z"),
        said("claude", "cc-old", "2026-08-01T12:00:00Z"),
      ],
      ROSTER,
    )
    expect(grouped.map((group) => group.agent.id)).toEqual(["claude", "opencode"])
  })

  test("each group in the order its rows arrived, which is newest first", () => {
    const grouped = groupedByAgent(
      [
        said("claude", "newer", "2026-08-20T00:00:00Z"),
        said("claude", "older", "2026-08-01T00:00:00Z"),
      ],
      ROSTER,
    )
    expect(grouped[0]?.sessions.map((row) => row.id)).toEqual(["newer", "older"])
  })

  test("an agent with NOTHING is not a heading over nothing", () => {
    const grouped = groupedByAgent([said("opencode", "a", null)], ROSTER)
    expect(grouped.map((group) => group.agent.id)).toEqual(["opencode"])
  })

  test("nothing stored at all is no groups", () => {
    expect(groupedByAgent([], ROSTER)).toEqual([])
  })

  test("a row naming an agent this machine does not have is dropped", () => {
    // It cannot arrive — the server builds the list by asking this same roster
    // — and if it did it would be a conversation nothing here could open, so a
    // heading for it would be an offer that refuses.
    const grouped = groupedByAgent(
      [said("claude", "mine", null), said("gemini", "theirs", null)],
      ROSTER,
    )
    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.sessions.map((row) => row.id)).toEqual(["mine"])
  })

  test("one agent installed is still one group, and the list draws no heading for it", () => {
    // The count is what the drawing turns on, so this is the assertion behind
    // "one installed agent is not a heading over the whole list".
    expect(groupedByAgent([said("claude", "a", null)], [CLAUDE])).toHaveLength(1)
  })
})

describe("what a person calls an agent", () => {
  test("its own name, out of the roster this server sent", () => {
    expect(nameOf(ROSTER, "opencode")).toBe("opencode")
    expect(nameOf(ROSTER, "claude")).toBe("Claude Code")
  })

  test("and the ID for one this machine does not have", () => {
    // A stale tab. The id is what would be sent back, and no name here is a
    // name for it — inventing one would be this list claiming to know an agent
    // it cannot reach.
    expect(nameOf(ROSTER, "gemini")).toBe("gemini")
  })
})
