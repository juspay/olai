import { describe, expect, test } from "bun:test"

import { sentAgent } from "../../outings.testlib.ts"
import { toolRow as row } from "./rows.testlib.ts"
import { doingOf, sentOf, whoOf } from "./spawn.ts"

describe("which rows sent somebody", () => {
  test("a call that spawned nobody has no face at all", () => {
    expect(whoOf(row({ status: "in_progress" }))).toBeNull()
    expect(doingOf(row({ status: "in_progress" }))).toBeNull()
    expect(whoOf(row({ parent: "tool:agent-1", status: "in_progress" }))).toBeNull()
  })

  test("a row that has not arrived yet has none either", () => {
    expect(whoOf(undefined)).toBeNull()
    expect(doingOf(undefined)).toBeNull()
  })
})

describe("who was sent", () => {
  test("the kind of agent, in the agent's own word", () => {
    expect(whoOf(row({ spawned: sentAgent({ kind: "Explore" }) }))).toBe("Explore")
    expect(whoOf(row({ spawned: sentAgent({ kind: "roadmap-auditor" }) }))).toBe("roadmap-auditor")
  })

  test("a spawn that named no kind still says somebody was sent", () => {
    expect(whoOf(row({ spawned: sentAgent() }))).toBe("Agent")
  })

  test("... and goes on saying it after the agent has reported back", () => {
    expect(whoOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "completed" })))
      .toBe("Explore")
  })
})

describe("whether it is still going", () => {
  test("an announced spawn is a RUNNING one, and says the same word as a beaten one", () => {
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }) }))).toBe("Working…")
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "pending" })))
      .toBe("Working…")
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "in_progress" })))
      .toBe("Working…")
  })

  test("a spawn that has stopped has nothing live left to say", () => {
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "completed" })))
      .toBeNull()
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "failed" })))
      .toBeNull()
  })

  test("nor has one whose TURN has ended, whatever its own status says", () => {
    expect(doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "pending", stranded: true })))
      .toBeNull()
    expect(
      doingOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "in_progress", stranded: true })),
    ).toBeNull()
    expect(whoOf(row({ spawned: sentAgent({ kind: "Explore" }), status: "pending", stranded: true })))
      .toBe("Explore")
  })
})

describe("what an agent was sent to do", () => {
  test("a call that sent nobody was sent to do nothing", () => {
    expect(sentOf(row({ status: "completed" }))).toBeNull()
    expect(sentOf(row({ parent: "tool:agent-1" }))).toBeNull()
    expect(sentOf(undefined)).toBeNull()
  })

  test("a spawn answers with its description, not with the tool's name", () => {
    expect(sentOf(row({ text: "Task", spawned: sentAgent({ said: "read every note" }) })))
      .toBe("read every note")
    expect(sentOf(row({ text: "Task", spawned: { kind: "Explore", said: "read every note" } })))
      .toBe("read every note")
  })

  test("... and falls back to what the row is called when it described none", () => {
    expect(sentOf(row({ text: "Task", spawned: sentAgent() }))).toBe("Task")
    expect(sentOf(row({ text: "read every note", spawned: sentAgent({ kind: "Explore" }) })))
      .toBe("read every note")
  })
})
