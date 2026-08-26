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
import type { PadiTerminal } from "@kolu/padi-client/surface"

import { TERMINAL_KEY } from "@olai/surface"

import { type Claimant, claimsIn, rowOf } from "./fleet.ts"

const claimant = (id: string, terminal: string | undefined): Claimant => ({
  id,
  title: `the ${id} step`,
  file: "orchestrator/lanes.olai",
  terminal,
})

const record = (over: Record<string, unknown> = {}): PadiTerminal =>
  ({
    state: "active",
    agent: { kind: "claude-code", state: "thinking" },
    cwd: "/home/srid/code/olai",
    git: {
      repoName: "olai",
      branch: "terminal-door",
      worktreePath: "/home/srid/code/olai/.worktrees/terminal-door",
    },
    intent: "the terminal door",
    lastActivityAt: 1_700_000_000_000,
    ...over,
  }) as unknown as PadiTerminal

describe("a fleet row", () => {
  it("carries the FOLD, not padi's state literals", () => {
    const row = rowOf("t1", record())
    expect(row.face).toBe("working")
    // The literal `thinking` is nowhere on the wire: a consumer that wanted it
    // would be re-deriving the fold, which is the drift this projection exists
    // to prevent.
    expect(JSON.stringify(row)).not.toContain("thinking")
  })

  it("narrows the agent to its short vendor name", () => {
    expect(rowOf("t1", record()).agent).toBe("claude")
    expect(rowOf("t1", record({ agent: null })).agent).toBeNull()
  })

  it("folds an absent intent to null rather than carrying two spellings", () => {
    // `intent` is `optionalKey` upstream, so absent and empty both mean "no
    // intent" — a wire that carried both would make every reader ask twice.
    expect(rowOf("t1", record({ intent: undefined })).intent).toBeNull()
  })

  it("is unowned unless something claims it", () => {
    expect(rowOf("t1", record()).owner).toEqual({ kind: "unowned" })
  })

  it("never wears the GONE face — a row that exists is a terminal that does", () => {
    // `faceOf` has four answers and a row can wear three. The narrowing is
    // spelled in `rowOf` rather than cast, so this is a claim about the wire
    // and not about a coincidence.
    for (const state of ["active", "sleeping", "parked"]) {
      expect(rowOf("t1", record({ state, agent: null })).face).not.toBe("gone")
    }
  })
})

describe("the ownership overlay", () => {
  it("claims a terminal by the `terminal` property, keyed on the prop KEY", () => {
    expect(TERMINAL_KEY).toBe("terminal")
    const claims = claimsIn([claimant("lane-1-implement", "t1")])
    expect(claims.get("t1")).toEqual({
      kind: "node",
      id: "lane-1-implement",
      title: "the lane-1-implement step",
      file: "orchestrator/lanes.olai",
    })
  })

  it("ignores a node that names nothing", () => {
    expect(claimsIn([claimant("a", undefined), claimant("b", "")]).size).toBe(0)
  })

  it("gives one terminal to the FIRST claimant, deterministically", () => {
    // Two nodes claiming one terminal is a thing people do — a copied property,
    // a lane and its step both carrying it — and it is not an error: both are
    // true statements about where the work happened. The row has room for one
    // link, so document order decides, and two tabs drawing the same fleet
    // agree because of it.
    const claims = claimsIn([claimant("first", "t1"), claimant("second", "t1")])
    expect(claims.get("t1")).toMatchObject({ kind: "node", id: "first" })
  })
})
