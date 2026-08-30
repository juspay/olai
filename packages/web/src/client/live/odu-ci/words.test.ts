/**
 * WHAT THE CI CHIP SAYS — the table of cases, so nobody has to start a CI run
 * to read one.
 *
 * `./words.ts` is pure and takes `now` as an argument for exactly this, which
 * is `../duration/took.ts`'s own arrangement one readout over.
 *
 * EVERY CASE BUILDS ITS NODES, and the counts follow from them. The fixtures
 * used to set a `tally` and a `verdict` beside the cells, which let a case
 * state a count its own nodes contradicted — the invariant that stopped
 * existing when those two left the wire and became folds over the cells
 * (`@olai/odu-client`'s `wire`). A case that wants `8/10 ok` now has to have
 * eight of them.
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

/** `n` nodes of one status, for the cases whose subject is a COUNT rather than
 *  any particular node. */
const many = (n: number, status: string): ReadonlyArray<RunCell> =>
  Array.from({ length: n }, (_, at) => cell({ id: `n${at}@p`, status }))

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
  ...over,
})

describe("a live run", () => {
  it("names the node that is running and how long it has been", () => {
    // The plan's own shape: `ci · e2e 2m10s · 8/10 ok`, in the register the
    // app already speaks for a ticking span (`m:ss` under an hour).
    const said = wordsFor(
      run({
        cells: [
          ...many(8, "ok"),
          cell({ id: "e2e@x86_64-linux", status: "running", startedAt: 100_000 }),
          cell({ id: "fmt@p", status: "pending" }),
        ],
      }),
      230_000,
    )
    expect(said.text).toBe("ci · e2e 2:10 · 8/10 ok")
    expect(said.tone).toBe("going")
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
    const said = wordsFor(run({ cells: [cell({ id: "e2e@p", status: "running" })] }), 500)
    expect(said.text).toBe("ci · e2e · 0/1 ok")
  })

  it("says odu's own phase word while the run is still claiming a machine", () => {
    // Nothing is running because nothing CAN be yet, and "what is this run
    // waiting for" is odu's question to answer.
    const said = wordsFor(run({ phase: "provisioning", cells: [] }), 0)
    // No count: `0/0 ok` is a sentence about nothing.
    expect(said.text).toBe("ci · provisioning")
    expect(said.tone).toBe("going")
  })

  it("goes RED the moment a node is, before the run has finished deciding", () => {
    // The ink and the verdict are different questions: a reader needs to know
    // now, and the verdict keeps the stricter rule.
    const said = wordsFor(
      run({
        cells: [
          cell({ id: "e2e@p", status: "running", startedAt: 0 }),
          cell({ id: "unit@p", status: "failed", red: true }),
          cell({ id: "fmt@p", status: "pending" }),
        ],
      }),
      61_000,
    )
    expect(said.tone).toBe("red")
    expect(said.text).toBe("ci · e2e 1:01 · 0/3 ok")
  })
})

describe("a run whose socket is gone", () => {
  it("says the verdict, in the verdict's ink", () => {
    const said = wordsFor(run({ live: false, cells: many(10, "ok") }), 10_000)
    expect(said.text).toBe("ci · ok · 10/10 ok")
    expect(said.tone).toBe("ok")
  })

  it("says `ended` for a run that stopped without deciding, and recedes", () => {
    // A coordinator that died mid-run decided nothing, and this is the chip
    // saying so rather than picking a colour for it.
    const said = wordsFor(
      run({
        live: false,
        cells: [cell({ id: "a@p", status: "ok" }), ...many(3, "pending")],
      }),
      10_000,
    )
    expect(said.text).toBe("ci · ended · 1/4 ok")
    expect(said.tone).toBe("quiet")
  })

  it("still says `ended` for a run killed with its first node RUNNING", () => {
    // grok's SHOULD on #433: this used to draw NOTHING, so a chip on screen as
    // `ci · e2e 2:10` vanished the moment the coordinator died. Running is
    // progress — a node that got as far as starting is something to report.
    const said = wordsFor(
      run({
        live: false,
        cells: [cell({ id: "e2e@p", status: "running", startedAt: 0 }), ...many(3, "pending")],
      }),
      61_000,
    )
    expect(said.text).toBe("ci · ended · 0/4 ok")
    expect(said.tone).toBe("quiet")
  })

  it("says `ended` for a run that never started a node either — a ROW is always a word", () => {
    // "Or nothing" is answered one layer up and always was: no row, no chip
    // (`./CiChip.tsx`, over `runOf`). A row that EXISTS is a run this server
    // watched, and what it saw is worth saying even when it saw nothing happen.
    expect(wordsFor(run({ live: false, cells: many(4, "pending") }), 0).text)
      .toBe("ci · ended · 0/4 ok")
  })
})

describe("the hover", () => {
  it("names WHICH run and WHERE olai looked — the two facts the face has no room for", () => {
    const said = wordsFor(run({ dirty: true, cells: [cell({ id: "a@p", status: "ok" })] }), 0)
    expect(said.title).toBe(
      "ci 8f8fe56#2+dirty · x86_64-linux=kolu-ci-9 · the run is up · /home/x/code/odu/.worktrees/a",
    )
  })

  it("says the socket is gone rather than pretending the last reading is current", () => {
    const said = wordsFor(
      run({ live: false, cells: [cell({ id: "a@p", status: "ok" })] }),
      0,
    )
    expect(said.title).toContain("the socket is gone; this is the last reading")
  })
})
