/**
 * THE PROJECTION AND THE OVERLAY — what crosses, and who claims it.
 *
 * The projection's own claim is small and worth pinning anyway: a row carries
 * the FOLD, not padi's state literals, so a chip never re-derives what the
 * server already decided and a new agent state is one file's change.
 *
 * The overlay's claim is the interesting one. `owner` is derived from the same
 * reading every page draws — a node carrying `terminal: <id>` — with nothing
 * persisted and nothing to keep in step. So the tests are about the two ways a
 * derivation like that goes wrong: a value that is not a single claim (a list),
 * and two nodes claiming one terminal.
 */

import { describe, expect, it } from "bun:test"
import type { TerminalMetadata } from "@kolu/padi-client/surface"

import { TERMINAL_KEY, UNOWNED } from "@olai/surface"

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
      repoName: "olai",
      branch: "terminal-door",
      worktreePath: "/home/srid/code/olai/.worktrees/terminal-door",
    },
    // A real record always carries the forge axis; `activePr` reads it without
    // guarding, so a fixture that omits it is testing a record padi never sends.
    pr: { kind: "absent" },
    intent: "the terminal door",
    lastActivityAt: 1_700_000_000_000,
    ...over,
  }) as unknown as TerminalMetadata

describe("a fleet row", () => {
  it("carries what KOLU'S ROW asks for, folded by kolu's own functions", () => {
    const row = rowOf("t1", record())
    // The pip is bound once, here, and travels as the ten facts it produced —
    // never re-derived in a browser, which is what the deleted `DotFace` was.
    expect(row.pip.variant).toBeString()
    expect(row.subline.fromAgent).toBe(true)
    expect(row.recencyAt).toBe(1_700_000_000_000)
  })

  it("carries the agent's state VERBATIM, and no closed set of olai's own", () => {
    // Ratified 2026-08-26: the wire carries kolu's vocabulary as plain text and
    // the row package's own guard narrows it back, so a state this build has
    // never heard of arrives as itself rather than as a neighbour.
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
    // padi computes the partition once, on the host, and every kolu surface
    // reads that answer — the two-subscriptions argument is stated in
    // `@kolu/padi-client/attention`'s header. A row that re-derived the class
    // from its own metadata is the disagreement the partition exists to stop.
    const asking = rowOf("t1", record(), UNOWNED, { klass: "asking", live: false })
    const idle = rowOf("t1", record(), UNOWNED, { klass: "idle", live: false })
    expect(asking.pip.asking).toBe(true)
    expect(idle.pip.asking).toBe(false)
    expect(asking.bucket).not.toBe(idle.bucket)
  })
})

describe("the ownership overlay", () => {
  /** The fleet, as padi keys it — whole uuids. */
  const FLEET = [
    "cb9dcd13-1e2e-4f7a-9c3d-2b5a7e8f1a44",
    "5976f8ab-77c1-4c9e-8a12-9f3e4d2b6c07",
    "5976aaaa-0000-4000-8000-000000000000",
  ]

  it("claims by an EIGHT-CHARACTER PREFIX, which is what the board writes", () => {
    // THE PRODUCTION DEFECT, on the server's side of it: this map used to be
    // keyed by the property's raw value, so a fleet keyed by uuid never met a
    // vault keyed by prefix and every row came out `unowned`.
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
    // Two ids begin `5976`. A value that names both has not claimed either,
    // and putting the lane's name on whichever sorted first would be a claim
    // nobody made. The CHIP says so in words; the rows stay unowned.
    expect(claimsIn([claimant("a", "5976")], FLEET).size).toBe(0)
  })

  it("claims nothing for a value with prose after the id", () => {
    // About ten of the board's values carry a remark. Pulling the id out of a
    // sentence is the wrong door `props/door.ts` refuses.
    expect(claimsIn([claimant("a", "cb9dcd13 (claude, dispatched 16:20)")], FLEET).size)
      .toBe(0)
  })

  it("ignores a node that names nothing", () => {
    expect(claimsIn([claimant("a", undefined), claimant("b", "")], FLEET).size).toBe(0)
  })

  it("gives one terminal to the FIRST claimant, deterministically", () => {
    // Two nodes claiming one terminal is a thing people do — a copied
    // property, a lane and its step both carrying it — and it is not an error:
    // both are true statements about where the work happened. The row has room
    // for one link, so document order decides, and two tabs drawing the same
    // fleet agree because of it. They may even spell it differently.
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
