/**
 * THE CELL'S `equals`, at its bench — and it had none.
 *
 * `sameCi` is what makes "a coordinator republishing its whole pipeline on
 * every node transition wakes no row that did not move" true, and nothing
 * asserted it: the watcher's bench asserts what is PUBLISHED, and the
 * framework's gate is what turns a publish into silence. It is derived from
 * the schema now (`Schema.toEquivalence`), so what is worth pinning is not the
 * arithmetic but the two claims the member rests on — a repeated reading is
 * the same reading, and each field a face draws off moves it.
 */

import { expect, test } from "bun:test"

import { type CiRun, type CiRuns, NO_RUNS, sameCi, settledOf, tallyOf, verdictOf } from "./index.ts"

const cell = (over: Partial<CiRun["cells"][number]> = {}) => ({
  id: "e2e@p",
  name: "e2e",
  platform: "p",
  status: "running",
  hue: "amber",
  glyph: "▶",
  red: false,
  startedAt: 1_000,
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
  seq: 1,
  phase: "lanes",
  lanes: ["p=localhost"],
  cells: [cell()],
  ...over,
})

const runs = (...all: ReadonlyArray<CiRun>): CiRuns => ({ runs: all })

test("a reading repeated is the same reading — the whole point of the member's gate", () => {
  expect(sameCi(runs(run()), runs(run()))).toBe(true)
  expect(sameCi(NO_RUNS, NO_RUNS)).toBe(true)
  expect(sameCi(NO_RUNS, { runs: [] })).toBe(true)
})

test("every field a face draws off moves it", () => {
  const before = runs(run())
  const moved: ReadonlyArray<Partial<CiRun>> = [
    { id: ".worktrees/b" },
    { at: "/elsewhere" },
    { live: false },
    { name: "other" },
    { sha7: "0000000" },
    { dirty: true },
    { seq: 2 },
    { phase: "provisioning" },
    { lanes: ["p=kolu-ci-9"] },
    { cells: [] },
  ]
  for (const over of moved) {
    expect([Object.keys(over)[0], sameCi(before, runs(run(over)))])
      .toEqual([Object.keys(over)[0], false])
  }
})

test("...and so does every field of a NODE, at the depth a repeated frame lives", () => {
  // The status transition and the two clock fields are what a coordinator's
  // republish actually moves; the rest ride along because the derivation is
  // the schema's rather than a list somebody kept.
  const before = runs(run())
  for (const over of [{ status: "ok" }, { startedAt: 2_000 }, { ms: 12 }, { id: "unit@p" }]) {
    expect(sameCi(before, runs(run({ cells: [cell(over)] })))).toBe(false)
  }
})

test("a run added or dropped moves it, and the count alone is not the question", () => {
  expect(sameCi(runs(run()), runs(run(), run({ id: ".worktrees/b" })))).toBe(false)
  expect(sameCi(runs(run()), NO_RUNS)).toBe(false)
  // Two runs whose ORDER swapped are two different readings: the cell carries
  // a list, and a list is a sequence.
  const a = run()
  const b = run({ id: ".worktrees/b" })
  expect(sameCi(runs(a, b), runs(b, a))).toBe(false)
})

test("the two folds count over the cells, and nothing else does", () => {
  // They left the wire in the same round `sameCi` was derived; this is the
  // whole of what a face gets back from holding the nodes.
  const cells = [
    cell({ id: "a@p", status: "ok" }),
    cell({ id: "b@p", status: "failed", red: true }),
    cell({ id: "c@p", status: "running" }),
  ]
  expect(tallyOf(cells)).toEqual({ total: 3, settled: 2, ok: 1, red: 1 })
  // SETTLED is its own reading: a red run settles too — the wake's question
  // is not the verdict's. An empty run has not settled (the empty-set trap).
  expect(settledOf(tallyOf(cells))).toBe(false)
  expect(settledOf(tallyOf([cell({ id: "d@p", status: "ok" })]))).toBe(true)
  expect(settledOf(tallyOf([cell({ id: "e@p", status: "failed", red: true })]))).toBe(true)
  expect(settledOf(tallyOf([]))).toBe(false)
  expect(verdictOf(tallyOf(cells))).toBe("red")
  expect(verdictOf(tallyOf([]))).toBeNull()
})
