/**
 * THE CHIP'S READING — and the one confusion it exists to prevent.
 *
 * The claim under test is not "green when working". It is that OLAI CANNOT SEE
 * and OLAI LOOKED AND IT IS QUIET never draw the same thing. A gray dot for an
 * unreachable padi would be a lie told once per lane, on a page somebody is
 * using to decide what to do next — and it is the exact failure a status glyph
 * with no words invites, which is why every arm here carries a sentence.
 */

import { describe, expect, it } from "bun:test"
import type { FleetTerminal, KoluLink } from "@olai/surface"

import { readingOf } from "./terminal.ts"

const link = (over: Partial<KoluLink> = {}): KoluLink => ({
  status: "connected",
  socket: "/run/user/1000/padi-abc/padi.sock",
  told: false,
  stateRoot: "/home/srid/.local/state/kolu",
  surfaceVersion: "5.4",
  speaks: "5.4",
  since: "2026-08-25T12:00:00-04:00",
  ...over,
})

const row = (over: Partial<FleetTerminal> = {}): FleetTerminal => ({
  id: "t1",
  face: "working",
  state: "active",
  agent: "claude",
  cwd: "/home/srid/code/olai",
  repo: "olai",
  branch: "terminal-door",
  worktree: null,
  intent: "the terminal door",
  lastActivityAt: null,
  owner: { kind: "unowned" },
  ...over,
})

const fleetOf = (...rows: FleetTerminal[]): ReadonlyMap<string, FleetTerminal> =>
  new Map(rows.map((one) => [one.id, one]))
const empty: ReadonlyMap<string, FleetTerminal> = new Map()

describe("a terminal chip", () => {
  it("reads the face the SERVER folded, and folds nothing itself", () => {
    for (const face of ["working", "awaiting", "parked"] as const) {
      const reading = readingOf("t1", link(), fleetOf(row({ face })))
      expect(reading.face).toBe(face)
      expect(reading.hollow).toBe(false)
    }
  })

  it("goes HOLLOW when there is no padi — never a gray dot", () => {
    const reading = readingOf("t1", link({ status: "absent" }), empty)
    expect(reading.hollow).toBe(true)
    // The whole point: a reader must not be able to mistake this for "quiet".
    expect(reading.says).toContain("no padi is running")
    expect(reading.says).toContain("/run/user/1000/padi-abc/padi.sock")
  })

  it("asks the LINK before the fleet, so an empty fleet is not mistaken for a dead one", () => {
    // A healthy kolu with nothing open has an empty fleet too. A chip that
    // looked the terminal up first would draw `gone` for every lane on a
    // laptop that simply is not running kolu — the same glyph, a completely
    // different fact.
    const noPadi = readingOf("t1", link({ status: "absent" }), empty)
    const noTerminal = readingOf("t1", link(), empty)
    expect(noPadi.hollow).toBe(true)
    expect(noTerminal.hollow).toBe(true)
    // Same shape, different sentence — which is the distinction that decides
    // what a reader does next.
    expect(noPadi.says).not.toBe(noTerminal.says)
    expect(noTerminal.says).toContain("no longer in the fleet")
  })

  it("names both versions on a skew, because one of the two has to move", () => {
    const reading = readingOf("t1", link({ status: "skew", surfaceVersion: "6.0" }), empty)
    expect(reading.hollow).toBe(true)
    expect(reading.says).toContain("6.0")
    expect(reading.says).toContain("5.4")
  })

  it("says $PADI_SOCKET when that is what pointed nowhere", () => {
    // "your variable points nowhere" and "no padi is running" are two different
    // things to go and fix, and `told` is the only thing that can tell them
    // apart.
    const reading = readingOf("t1", link({ status: "absent", told: true }), empty)
    expect(reading.says).toContain("$PADI_SOCKET")
  })

  it("carries the row behind a live dot and nothing behind a hollow", () => {
    expect(readingOf("t1", link(), fleetOf(row())).row).toBeDefined()
    expect(readingOf("t1", link({ status: "absent" }), empty).row).toBeUndefined()
  })

  it("builds a sentence out of the parts that are actually there", () => {
    expect(readingOf("t1", link(), fleetOf(row())).says)
      .toBe("working · the terminal door · in terminal-door")
    // A plain shell in no repository with no intent is an ordinary terminal,
    // and its sentence must not be three separators and two blanks.
    const bare = row({ face: "parked", intent: null, branch: null, repo: null, cwd: null })
    expect(readingOf("t1", link(), fleetOf(bare)).says).toBe("nothing running")
  })
})

describe("the unwired chip", () => {
  it("does not say 'olai looked at .' when there is no socket to name", () => {
    // A run drawn outside the fleet provider gets `KOLU_UNDIALED`, whose socket
    // is the empty string — a document's frontmatter, a test that mounts a
    // chip, and the first instant of a server's life. The naming sentence would
    // send a reader hunting for a path that is not there.
    const reading = readingOf("t1", { ...link(), status: "absent", socket: "" }, empty)
    expect(reading.hollow).toBe(true)
    expect(reading.says).toBe("olai is not watching a padi here.")
    expect(reading.says).not.toContain("looked at .")
  })
})
