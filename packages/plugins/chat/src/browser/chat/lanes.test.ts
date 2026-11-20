import type { ChatEntry } from "olai-plugin-chat/wire"
import { describe, expect, test } from "bun:test"

import { filedUnder, laneOf } from "./lanes.ts"

const row = (id: string, parent?: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "tool",
  text: id,
  status: "pending",
  ...(parent === undefined ? {} : { parent }),
})

const asked = (id: string, parent?: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "ask",
  text: id,
  ask: { fields: [], link: null, outcome: null },
  ...(parent === undefined ? {} : { parent }),
})

const said = (id: string): ChatEntry => ({
  id,
  seq: 0,
  since: "2026-08-21T12:00:00.000Z",
  kind: "agent",
  text: id,
})

const NOTHING = undefined

const nameOf = (key: string): string | undefined =>
  key.startsWith("tool:agent-") ? `sent to ${key}` : undefined

describe("which rows are drawn in a lane", () => {
  test("a row nobody else made is in no lane at all", () => {
    expect(laneOf(row("agent:2"), row("agent:1"), nameOf)).toBeNull()
    expect(laneOf(row("agent:1"), NOTHING, nameOf)).toBeNull()
    expect(laneOf(row("tool:call-2"), row("tool:call-1", "tool:agent-1"), nameOf)).toBeNull()
  })

  test("a row that has not arrived yet is in no lane either", () => {
    expect(laneOf(undefined, row("tool:agent-1"), nameOf)).toBeNull()
  })

  test("a call drawn under the very frame that spawned it is not drawn here at all", () => {
    const call = row("tool:call-1", "tool:agent-1")
    expect(filedUnder(call)).toBe("tool:agent-1")
    expect(laneOf(call, row("tool:call-0", "tool:agent-1"), () => undefined))
      .toEqual({ parent: "tool:agent-1", label: null })
  })

  test("one agent's second call carries on the lane it is already in", () => {
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-1"),
        row("tool:call-1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: null })
  })

  test("two agents at once each say who they are", () => {
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-2"),
        row("tool:call-1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-2", label: "sent to tool:agent-2" })
    expect(
      laneOf(
        row("tool:call-3", "tool:agent-1"),
        row("tool:call-2", "tool:agent-2"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("a lane resumed after the main agent spoke says who it is again", () => {
    expect(laneOf(row("tool:call-4", "tool:agent-1"), row("agent:4"), nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("the first row of the transcript can still open a lane", () => {
    expect(laneOf(row("tool:call-1", "tool:agent-1"), NOTHING, nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("a frame the panel never got is still somebody, and still a lane", () => {
    expect(laneOf(row("tool:call-1", "tool:gone"), NOTHING, nameOf))
      .toEqual({ parent: "tool:gone", label: "A subagent" })
  })

  test("a subagent's question names its lane even where a call would not", () => {
    expect(laneOf(asked("ask:1", "tool:agent-1"), row("tool:agent-1"), nameOf))
      .toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
    expect(
      laneOf(asked("ask:1", "tool:agent-1"), row("tool:call-1", "tool:agent-1"), nameOf),
    ).toEqual({ parent: "tool:agent-1", label: "sent to tool:agent-1" })
  })

  test("the main agent's own question is in no lane, named or otherwise", () => {
    expect(laneOf(asked("ask:1"), row("tool:call-1", "tool:agent-1"), nameOf))
      .toBeNull()
  })

  test("a question does not make the lane under it open again", () => {
    expect(
      laneOf(
        row("tool:call-2", "tool:agent-1"),
        asked("ask:1", "tool:agent-1"),
        nameOf,
      ),
    ).toEqual({ parent: "tool:agent-1", label: null })
  })

  test("a question from an agent the panel never saw start still says somebody", () => {
    expect(laneOf(asked("ask:1", "tool:gone"), row("tool:gone"), nameOf))
      .toEqual({ parent: "tool:gone", label: "A subagent" })
  })

  test("a row whose own key is another agent's does not answer for it", () => {
    expect(laneOf(row("tool:agent-1", "tool:agent-2"), row("tool:agent-1"), nameOf))
      .toEqual({ parent: "tool:agent-2", label: "sent to tool:agent-2" })
  })
})

describe("which rows leave the column entirely", () => {
  test("a call a subagent made answers with the agent that made it", () => {
    expect(filedUnder(row("tool:call-1", "tool:agent-1"))).toBe("tool:agent-1")
  })

  test("the main agent's own call stays in the column", () => {
    expect(filedUnder(row("tool:call-1"))).toBeNull()
  })

  test("a subagent's QUESTION stays in the column whoever asked it", () => {
    expect(filedUnder(asked("ask:1", "tool:agent-1"))).toBeNull()
  })

  test("a row that is neither a call nor a question is the column's", () => {
    expect(filedUnder(said("agent:1"))).toBeNull()
  })

  test("a row that has not arrived yet is filed nowhere", () => {
    expect(filedUnder(undefined)).toBeNull()
  })
})
