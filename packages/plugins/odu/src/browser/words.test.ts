import type { CiRun, RunCell } from "olai-plugin-odu/appliance/wire"
import { describe, expect, it } from "bun:test"

import { runningIn, wordsFor as saidFor } from "./words.ts"

const ticking = (elapsedMs: number): string => {
  const seconds = Math.floor(Math.max(0, elapsedMs) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const wordsFor = (run: CiRun, now: number) => saidFor(run, now, ticking)

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

const many = (n: number, status: string): ReadonlyArray<RunCell> =>
  Array.from({ length: n }, (_, at) => cell({ id: `n${at}@p`, status }))

const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: "m1kb0e11-2c8d",
  repoRoot: "/home/x/code/olai/.worktrees/a",
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
    const said = wordsFor(run({ cells: [cell({ id: "e2e@p", status: "running" })] }), 500)
    expect(said.text).toBe("ci · e2e · 0/1 ok")
  })

  it("says odu's own phase word while the run is still claiming a machine", () => {
    const said = wordsFor(run({ phase: "provisioning", cells: [] }), 0)
    expect(said.text).toBe("ci · provisioning")
    expect(said.tone).toBe("going")
  })

  it("says waiting while live with no phase and no running node", () => {
    const said = wordsFor(run({ phase: "", cells: [] }), 0)
    expect(said.text).toBe("ci · waiting")
    expect(said.tone).toBe("going")
  })

  it("goes RED the moment a node is, before the run has finished deciding", () => {
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
    const said = wordsFor(run({ cells: many(10, "ok") }), 10_000)
    expect(said.text).toBe("ci · lanes · 10/10 ok")
    expect(said.tone).toBe("ok")
    expect(said.title).toContain("Running")
  })
})

describe("a run that is no longer live", () => {
  it("says the verdict, in the verdict's ink", () => {
    const said = wordsFor(run({ state: "settled", outcome: "passed", cells: many(10, "ok") }), 10_000)
    expect(said.text).toBe("ci · passed · 10/10 ok")
    expect(said.tone).toBe("ok")
  })

  it("says `incomplete` for a run that stopped without deciding, and recedes", () => {
    const said = wordsFor(
      run({
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
    const said = wordsFor(run({ state: "owner_lost", cells: many(2, "ok") }), 0)
    expect(said.text).toContain("owner lost")
  })

  it("says `unknown run` for a boarded id the service does not know", () => {
    const said = wordsFor(run({ state: "unknown", repoRoot: "", cells: [] }), 0)
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
      run({ state: "settled", outcome: "passed", cells: [cell({ id: "a@p", status: "ok" })] }),
      0,
    )
    expect(said.title).toContain("Finished")
    expect(said.title).toContain("/home/x/code/olai/.worktrees/a")
  })

  it("says a lost owner and an unknown run in plain words", () => {
    expect(wordsFor(run({ state: "owner_lost", cells: many(2, "ok") }), 0).title)
      .toContain("Stopped unexpectedly")
    const unknown = wordsFor(run({ state: "unknown", repoRoot: "", cells: [] }), 0)
    expect(unknown.title).toContain("Unknown run")
    expect(unknown.title).toContain("Unknown checkout")
  })
})
