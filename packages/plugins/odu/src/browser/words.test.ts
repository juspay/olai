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
 *
 * ## THE TICKING REGISTER IS A FIXTURE HERE, and that is the right line
 *
 * `wordsFor` is handed the spelling of a running figure rather than reaching
 * for one, because that register is the APP'S — one ladder for the pomodoro
 * pill, the uptime chip and this (`./words.ts`'s header, and `./app.ts` on why
 * the app hands its contracts across). So the fixture below IS that ladder, and
 * the split it draws is deliberate: the app's own suite is where `m:ss` versus
 * `2h 34m` is argued and asserted, and what THIS file is about is the SENTENCE
 * — which node is named, when the count is dropped, when the ink goes red. A
 * case here that broke because the app coarsened its ladder would be a case
 * asserting somebody else's decision.
 */

import type { CiRun, RunCell } from "olai-plugin-odu/appliance/wire"
import { describe, expect, it } from "bun:test"

import { runningIn, wordsFor as saidFor } from "./words.ts"

/** The app's ticking register, as this table spends it — see the header. */
const ticking = (elapsedMs: number): string => {
  const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** ...so every case below reads as it always did: a run and a clock. */
const wordsFor = (run: CiRun, now: number) => saidFor(run, now, ticking)

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
  attempt: 1,
  host: null,
  logKey: `log:${over.id}`,
  ...over,
})

/** `n` nodes of one status, for the cases whose subject is a COUNT rather than
 *  any particular node. */
const many = (n: number, status: string): ReadonlyArray<RunCell> =>
  Array.from({ length: n }, (_, at) => cell({ id: `n${at}@p`, status }))

const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: "m1kb0e11-2c8d",
  repoRoot: "/home/x/code/olai/.worktrees/a",
  live: true,
  name: "ci",
  sha7: "8f8fe56",
  dirty: false,
  seq: 2,
  state: "running",
  outcome: null,
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

  it("says waiting while live with no phase and no running node", () => {
    const said = wordsFor(run({ phase: "", cells: [] }), 0)
    expect(said.text).toBe("ci · waiting")
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

  it("takes the done ink the moment the cells settle, even while the run is still live", () => {
    const said = wordsFor(run({ live: true, cells: many(10, "ok") }), 10_000)
    expect(said.text).toBe("ci · lanes · 10/10 ok")
    expect(said.tone).toBe("ok")
    expect(said.title).toContain("the run is up")
  })
})

describe("a run that is no longer live", () => {
  it("says the verdict, in the verdict's ink", () => {
    const said = wordsFor(run({ live: false, state: "settled", outcome: "passed", cells: many(10, "ok") }), 10_000)
    expect(said.text).toBe("ci · passed · 10/10 ok")
    expect(said.tone).toBe("ok")
  })

  it("says `incomplete` for a run that stopped without deciding, and recedes", () => {
    const said = wordsFor(
      run({
        live: false,
        state: "settled",
        outcome: "incomplete",
        cells: [cell({ id: "a@p", status: "ok" }), ...many(3, "pending")],
      }),
      10_000,
    )
    expect(said.text).toBe("ci · incomplete · 1/4 ok")
    expect(said.tone).toBe("quiet")
  })

  it("says `owner lost` as itself", () => {
    const said = wordsFor(run({ live: false, state: "owner_lost", cells: many(2, "ok") }), 0)
    expect(said.text).toContain("owner lost")
  })

  it("says `unknown run` for a boarded id the service does not know", () => {
    const said = wordsFor(run({ live: false, state: "unknown", repoRoot: "", cells: [] }), 0)
    expect(said.text).toBe("ci · unknown run")
  })
})

describe("the hover", () => {
  it("names WHICH run and WHERE olai looked — the two facts the face has no room for", () => {
    const said = wordsFor(run({ dirty: true, cells: [cell({ id: "a@p", status: "ok" })] }), 0)
    expect(said.title).toContain("ci 8f8fe56#2+dirty")
    expect(said.title).toContain("m1kb0e11-2c8d")
    expect(said.title).toContain("/home/x/code/olai/.worktrees/a")
  })

  it("names the checkout a settled run ran in", () => {
    const said = wordsFor(
      run({ live: false, state: "settled", outcome: "passed", cells: [cell({ id: "a@p", status: "ok" })] }),
      0,
    )
    expect(said.title).toContain("settled")
    expect(said.title).toContain("/home/x/code/olai/.worktrees/a")
  })
})
