import { describe, expect, it } from "bun:test"
import type { TerminalMetadata } from "@kolu/padi-client/surface"

import { TERMINAL_KEY, UNOWNED } from "./wire/index.ts"

import { type Claimant, claimsIn, rowOf } from "./fleet.ts"

const claimant = (id: string, terminal: string | undefined): Claimant => ({
  id,
  title: `the ${id} step`,
  file: "orchestrator/lanes.olai",
  terminal,
})

const record = (over: Record<string, unknown> = {}): TerminalMetadata =>
  ({
    state: "active",
    agent: { kind: "claude-code", state: "thinking" },
    cwd: "/home/srid/code/olai",
    git: {
      kind: "repo",
      info: {
        repoName: "olai",
        branch: "terminal-door",
        worktreePath: "/home/srid/code/olai/.worktrees/terminal-door",
      },
    },
    pr: { kind: "absent" },
    intent: "the terminal door",
    lastActivityAt: 1_700_000_000_000,
    ...over,
  }) as unknown as TerminalMetadata

describe("a fleet row", () => {
  it("carries what KOLU'S ROW asks for, folded by kolu's own functions", () => {
    const row = rowOf("t1", record())
    expect(row.pip.variant).toBeString()
    expect(row.subline.fromAgent).toBe(true)
    expect(row.recencyAt).toBe(1_700_000_000_000)
  })

  it("carries the agent's state VERBATIM, and no closed set of olai's own", () => {
    expect(rowOf("t1", record()).agentState).toBe("thinking")
    expect(rowOf("t1", record({ agent: null })).agentState).toBeNull()
  })

  it("labels the row with the intent's first line, else the branch", () => {
    expect(rowOf("t1", record()).label).toBe("the terminal door")
    expect(rowOf("t1", record({ intent: "line one\nline two" })).label).toBe("line one")
    expect(rowOf("t1", record({ intent: undefined })).label).toBe("terminal-door")
  })

  it("is unowned unless something claims it", () => {
    expect(rowOf("t1", record()).owner).toEqual({ kind: "unowned" })
  })

  it("paints from the ATTENTION it is handed, never from the record", () => {
    const asking = rowOf("t1", record(), UNOWNED, { klass: "asking", live: false })
    const idle = rowOf("t1", record(), UNOWNED, { klass: "idle", live: false })
    expect(asking.pip.asking).toBe(true)
    expect(idle.pip.asking).toBe(false)
    expect(asking.bucket).not.toBe(idle.bucket)
  })
})

describe("the ownership overlay", () => {
  const FLEET = [
    "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44",
    "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07",
    "5976aaaa-0000-4000-8000-000000000000",
  ]

  it("claims by an EIGHT-CHARACTER PREFIX, which is what the board writes", () => {
    expect(TERMINAL_KEY).toBe("terminal")
    const claims = claimsIn([claimant("lane-1-implement", "cb9dcd13")], FLEET)
    expect(claims.get("cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44")).toEqual({
      kind: "node",
      id: "lane-1-implement",
      title: "the lane-1-implement step",
      file: "orchestrator/lanes.olai",
    })
  })

  it("claims by a whole uuid too, which nine of the board's values are", () => {
    const claims = claimsIn(
      [claimant("lane-1-implement", "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07")],
      FLEET,
    )
    expect(claims.get("5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07")).toMatchObject({
      kind: "node",
      id: "lane-1-implement",
    })
  })

  it("claims NOTHING with an ambiguous prefix", () => {
    expect(claimsIn([claimant("a", "5976")], FLEET).size).toBe(0)
  })

  it("claims nothing for a value with prose after the id", () => {
    expect(claimsIn([claimant("a", "cb9dcd13 (claude, dispatched 16:20)")], FLEET).size)
      .toBe(0)
  })

  it("ignores a node that names nothing", () => {
    expect(claimsIn([claimant("a", undefined), claimant("b", "")], FLEET).size).toBe(0)
  })

  it("gives one terminal to the FIRST claimant, deterministically", () => {
    const claims = claimsIn(
      [
        claimant("first", "cb9dcd13"),
        claimant("second", "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44"),
      ],
      FLEET,
    )
    expect(claims.get("cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44")).toMatchObject({
      kind: "node",
      id: "first",
    })
  })
})
