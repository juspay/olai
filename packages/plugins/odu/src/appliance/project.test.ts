import type { NodesFrame, RunNode, RunRow } from "@odu/service-client/surface"
import { expect, test } from "bun:test"

import { runOf, unknownOf } from "./project.ts"
import { liveOf, tallyOf, verdictOf } from "./wire/index.ts"

const node = (over: Partial<RunNode> & { readonly id: string }): RunNode => ({
  status: "pending",
  attempt: 1,
  exitCode: null,
  startedAt: null,
  durationMs: null,
  host: null,
  logKey: `log:${over.id}`,
  ...over,
})

const row = (over: Partial<RunRow> = {}): RunRow => ({
  runId: "m1kb0e11-2c8d",
  repo: "juspay/olai",
  repoRoot: "/home/x/code/olai/.worktrees/a",
  branch: "master",
  sha: "8f8fe56aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  dirty: false,
  seq: 1,
  pipeline: "ci",
  createdAt: 1,
  state: "running",
  settled: false,
  passed: false,
  outcome: null,
  actionable: false,
  unresolvedFailures: 0,
  scope: { selectors: [], platforms: [], noDeps: false },
  reportingDebt: 0,
  endpoint: null,
  parentRunId: null,
  cursor: "m1kb0e11-2c8d@0",
  ...over,
})

const frame = (nodes: ReadonlyArray<RunNode>, over: Partial<NodesFrame> = {}): NodesFrame => ({
  order: nodes.map((one) => one.id),
  nodes: [...nodes],
  state: "running",
  env: {
    phase: "lanes",
    elapsedMs: 10,
    lanes: [{ state: "leased", platform: "linux", host: "this-host" }],
    hostsSource: null,
    commitUrl: null,
    owed: [],
  },
  done: false,
  ...over,
})

test("a node crosses as odu's own word plus the MEANINGS odu's table folds for it", () => {
  const run = runOf(row(), frame([node({ id: "e2e@x86_64-linux", status: "failed", exitCode: 1 })]))
  expect(run.id).toBe("m1kb0e11-2c8d")
  expect(run.repoRoot).toBe("/home/x/code/olai/.worktrees/a")
  expect(run.sha7).toBe("8f8fe56")
  expect(run.cells).toEqual([{
    id: "e2e@x86_64-linux",
    name: "e2e",
    platform: "x86_64-linux",
    status: "failed",
    hue: "red",
    glyph: "✗",
    red: true,
    startedAt: null,
    ms: null,
    attempt: 1,
    host: null,
    logKey: "log:e2e@x86_64-linux",
  }])
})

test("`cancelled` is not red", () => {
  const run = runOf(row(), frame([node({ id: "a@p", status: "cancelled" })]))
  expect(run.cells[0]?.red).toBe(false)
  expect(tallyOf(run.cells).red).toBe(0)
})

test("a boarded id the service does not know is unknown", () => {
  const run = unknownOf("nope-xxxx")
  expect(run.state).toBe("unknown")
  expect(liveOf(run.state)).toBe(false)
  expect(verdictOf(run)).toBeNull()
})

test("a settled row without a frame still carries the catalog's outcome", () => {
  const run = runOf(row({ state: "settled", settled: true, passed: true, outcome: "passed" }), undefined)
  expect(liveOf(run.state)).toBe(false)
  expect(run.phase).toBe("")
  expect(run.cells).toEqual([])
  expect(verdictOf(run)).toBe("passed")
})
