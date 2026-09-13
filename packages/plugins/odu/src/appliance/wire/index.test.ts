import { expect, test } from "bun:test"

import { type CiRun, type CiRuns, liveOf, NO_RUNS, sameCi, settledOf, tallyOf, verdictOf } from "./index.ts"

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
  attempt: 1,
  host: null as string | null,
  logKey: "log:e2e@p",
  ...over,
})

const run = (over: Partial<CiRun> = {}): CiRun => ({
  id: "m1kb0e11-2c8d",
  repoRoot: "/home/x/code/olai/.worktrees/a",
  name: "ci",
  sha7: "8f8fe56",
  dirty: false,
  seq: 1,
  state: "running",
  outcome: null,
  phase: "lanes",
  lanes: ["p=localhost"],
  cells: [cell()],
  ...over,
})

const runs = (...all: ReadonlyArray<CiRun>): CiRuns => ({ runs: all })

test("a reading repeated is the same reading", () => {
  expect(sameCi(runs(run()), runs(run()))).toBe(true)
  expect(sameCi(NO_RUNS, NO_RUNS)).toBe(true)
})

test("every field a face draws off moves it", () => {
  const before = runs(run())
  for (const over of [{ id: "other-idxx" }, { repoRoot: "/elsewhere" }, { state: "settled" }]) {
    expect(sameCi(before, runs(run(over)))).toBe(false)
  }
})

test("verdictOf prefers the catalog outcome and otherwise folds cells", () => {
  expect(verdictOf(run({ outcome: "passed", state: "settled" }))).toBe("passed")
  expect(verdictOf(run({ cells: [cell({ status: "failed", red: true })] }))).toBe("failed")
  expect(settledOf(tallyOf([]))).toBe(false)
})

test("liveOf is provisioning or running", () => {
  expect(liveOf("provisioning")).toBe(true)
  expect(liveOf("running")).toBe(true)
  expect(liveOf("settled")).toBe(false)
  expect(liveOf("unknown")).toBe(false)
})
