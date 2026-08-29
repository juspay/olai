/**
 * WHAT THE CI CHIP SAYS — the table of cases, so nobody has to start a CI run
 * to read one.
 *
 * `./words.ts` is pure and takes `now` as an argument for exactly this, which
 * is `../took.ts`'s own arrangement one readout over.
 */

import type { CiRun, RunCell } from "@olai/surface"
import { describe, expect, it } from "bun:test"

import { runningIn, wordsFor } from "./words.ts"

/** One node, as the wire carries it. The STATUS is required rather than
 *  defaulted, which is the fixture doing the type's job: every case here is
 *  about what a status makes the chip say, so a node whose status was decided
 *  by this helper would be a case asserting about a default. */
const cell = (
  over: Partial<RunCell> & { readonly id: string; readonly status: string },
): RunCell => ({
  name: over.id.split("@")[0] ?? over.id,
  platform: "x86_64-linux",
  hue: "grey",
  glyph: "◦",
  red: false,
  startedAt: null,
  ms: null,
  ...over,
})

const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: ".worktrees/a",
  at: "/home/x/code/odu/.worktrees/a",
  live: true,
  name: "ci",
  sha7: "8f8fe56",
  dirty: false,
  seq: 2,
  phase: "lanes",
  lanes: ["x86_64-linux=kolu-ci-9"],
  cells: [],
  tally: { total: 0, settled: 0, ok: 0, red: 0 },
  verdict: null,
  ...over,
})

describe("a live run", () => {
  it("names the node that is running and how long it has been", () => {
    // The plan's own shape: `ci · e2e 2m10s · 8/10 ok`, in the register the
    // app already speaks for a ticking span (`m:ss` under an hour).
    const said = wordsFor(
      run({
        cells: [
          cell({ id: "typecheck@x86_64-linux", status: "ok" }),
          cell({ id: "e2e@x86_64-linux", status: "running", startedAt: 100_000 }),
        ],
        tally: { total: 10, settled: 8, ok: 8, red: 0 },
      }),
      230_000,
    )
    expect(said?.text).toBe("ci · e2e 2:10 · 8/10 ok")
    expect(said?.tone).toBe("going")
  })

  it("names the FIRST running node in the run's own order, so the chip does not flicker", () => {
    const held = run({
      cells: [
        cell({ id: "a@p", status: "running", startedAt: 0 }),
        cell({ id: "b@p", status: "running", startedAt: 0 }),
      ],
    })
    expect(runningIn(held)?.id).toBe("a@p")
  })

  it("drops the duration on a running node with no start — a name is better than a `0:00`", () => {
    // That figure would read as a node stuck for a second, when what happened
    // is a frame that arrived between two writes.
    const said = wordsFor(
      run({
        cells: [cell({ id: "e2e@p", status: "running" })],
        tally: { total: 1, settled: 0, ok: 0, red: 0 },
      }),
      500,
    )
    expect(said?.text).toBe("ci · e2e · 0/1 ok")
  })

  it("says odu's own phase word while the run is still claiming a machine", () => {
    // Nothing is running because nothing CAN be yet, and "what is this run
    // waiting for" is odu's question to answer.
    const said = wordsFor(run({ phase: "provisioning", cells: [] }), 0)
    // No count: `0/0 ok` is a sentence about nothing.
    expect(said?.text).toBe("ci · provisioning")
    expect(said?.tone).toBe("going")
  })

  it("goes RED the moment a node is, before the run has finished deciding", () => {
    // The ink and the verdict are different questions: a reader needs to know
    // now, and the wire's verdict keeps the stricter rule.
    const said = wordsFor(
      run({
        cells: [
          cell({ id: "e2e@p", status: "running", startedAt: 0 }),
          cell({ id: "unit@p", status: "failed", red: true }),
        ],
        tally: { total: 3, settled: 1, ok: 0, red: 1 },
        verdict: "red",
      }),
      61_000,
    )
    expect(said?.tone).toBe("red")
    expect(said?.text).toBe("ci · e2e 1:01 · 0/3 ok")
  })
})

describe("a run whose socket is gone", () => {
  it("says the verdict, in the verdict's ink", () => {
    const said = wordsFor(
      run({
        live: false,
        cells: [cell({ id: "a@p", status: "ok" })],
        tally: { total: 10, settled: 10, ok: 10, red: 0 },
        verdict: "ok",
      }),
      10_000,
    )
    expect(said?.text).toBe("ci · ok · 10/10 ok")
    expect(said?.tone).toBe("ok")
  })

  it("says `ended` for a run that stopped without deciding, and recedes", () => {
    // A coordinator that died mid-run decided nothing, and this is the chip
    // saying so rather than picking a colour for it.
    const said = wordsFor(
      run({
        live: false,
        cells: [cell({ id: "a@p", status: "ok" })],
        tally: { total: 4, settled: 1, ok: 1, red: 0 },
      }),
      10_000,
    )
    expect(said?.text).toBe("ci · ended · 1/4 ok")
    expect(said?.tone).toBe("quiet")
  })

  it("says NOTHING AT ALL for a run that went before a single node settled", () => {
    // The plan's "or nothing": there is no verdict and no progress to report,
    // so the honest drawing is no chip and the lane's line is what it was.
    expect(
      wordsFor(run({ live: false, tally: { total: 4, settled: 0, ok: 0, red: 0 } }), 0),
    ).toBeUndefined()
  })
})

describe("the hover", () => {
  it("names WHICH run and WHERE olai looked — the two facts the face has no room for", () => {
    const said = wordsFor(run({ dirty: true, cells: [cell({ id: "a@p", status: "ok" })] }), 0)
    expect(said?.title).toBe(
      "ci 8f8fe56#2+dirty · x86_64-linux=kolu-ci-9 · the run is up · /home/x/code/odu/.worktrees/a",
    )
  })

  it("says the socket is gone rather than pretending the last reading is current", () => {
    const said = wordsFor(
      run({ live: false, cells: [cell({ id: "a@p", status: "ok" })], verdict: "ok", tally: { total: 1, settled: 1, ok: 1, red: 0 } }),
      0,
    )
    expect(said?.title).toContain("the socket is gone; this is the last reading")
  })
})
