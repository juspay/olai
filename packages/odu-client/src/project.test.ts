/**
 * ODU'S RECORD → OLAI'S ROW, at its bench.
 *
 * The claims worth pinning are the ones a reader would not be able to check by
 * eye: that a status's MEANING comes off odu's own table rather than a copy of
 * it, that an unknown status survives the crossing, that the tally counts the
 * way a verdict does, and that a run gone is a row kept.
 */

import { EMPTY_HEADER, EMPTY_STATE, pendingNode } from "@odu/run-client/surface"
import type { NodeState, PipelineState, RunHeader } from "@odu/run-client/surface"
import { expect, test } from "bun:test"

import { runOf, wentOf } from "./project.ts"
import { tallyOf, verdictOf } from "./wire/index.ts"

const SEED = { id: ".worktrees/a", at: "/home/x/code/odu/.worktrees/a" }

const node = (id: string, over: Partial<NodeState> = {}): NodeState => ({
  ...pendingNode({ id, name: id, command: "just check", needs: [] }),
  ...over,
})

const state = (nodes: ReadonlyArray<NodeState>, over: Partial<PipelineState> = {}): PipelineState => ({
  ...EMPTY_STATE,
  name: "ci",
  sha7: "8f8fe56",
  order: nodes.map((one) => one.id),
  nodes: Object.fromEntries(nodes.map((one) => [one.id, one])),
  ...over,
})

const header = (over: Partial<RunHeader> = {}): RunHeader => ({
  ...EMPTY_HEADER,
  startedAt: 1_000,
  ...over,
})

test("a node crosses as odu's own word plus the MEANINGS odu's table folds for it", () => {
  const run = runOf(SEED, state([node("e2e@x86_64-linux", { status: "failed", exitCode: 1 })]), header())
  expect(run.cells).toEqual([{
    id: "e2e@x86_64-linux",
    // The id is SPLIT because the matrix draws the two on two axes, through
    // odu's own fold rather than a second `lastIndexOf("@")` here.
    name: "e2e",
    platform: "x86_64-linux",
    status: "failed",
    hue: "red",
    glyph: "✗",
    red: true,
    startedAt: null,
    ms: null,
  }])
})

test("`cancelled` is not red, which is a distinction only odu's table holds", () => {
  // A deliberate lane drop is not a test failure and not an infra death. A
  // second table here would have had to remember that; reading odu's cannot
  // forget it.
  const run = runOf(SEED, state([node("a@p", { status: "cancelled" })]), header())
  expect(run.cells[0]?.red).toBe(false)
  expect(tallyOf(run.cells).red).toBe(0)
  expect(tallyOf(run.cells).settled).toBe(1)
})

test("an `errored` node keeps its own hue — infra death is not a red test", () => {
  const run = runOf(SEED, state([node("a@p", { status: "errored" })]), header())
  expect(run.cells[0]?.hue).toBe("violet")
  expect(run.cells[0]?.red).toBe(true)
})

test("a status this build never heard of PASSES THROUGH rather than being folded onto a neighbour", () => {
  // odu is free to add one, and a face that normalised it would draw a lie.
  // The word survives; the meanings fall back to the quiet ones.
  const run = runOf(
    SEED,
    state([node("a@p", { status: "flaked" as NodeState["status"] })]),
    header(),
  )
  expect(run.cells[0]?.status).toBe("flaked")
  expect(run.cells[0]?.hue).toBe("grey")
  expect(run.cells[0]?.red).toBe(false)
  // ...and it counts as SETTLED, because settled is the complement of the two
  // statuses that are on their way somewhere — so a chip does not stall at
  // `9/10` forever on a word nobody taught it.
  expect(tallyOf(run.cells).settled).toBe(1)
})

test("the tally counts over the run's own order, and the verdict waits for every node", () => {
  const run = runOf(
    SEED,
    state([
      node("a@p", { status: "ok" }),
      node("b@p", { status: "running", startedAt: 2_000 }),
      node("c@p"),
    ]),
    header(),
  )
  expect(tallyOf(run.cells)).toEqual({ total: 3, settled: 1, ok: 1, red: 0 })
  // A green claim about work that has not run is the one thing a CI face must
  // never make.
  expect(verdictOf(tallyOf(run.cells))).toBeNull()
})

test("RED WINS EARLY — a run with a red node is red before the rest finish", () => {
  const run = runOf(
    SEED,
    state([node("a@p", { status: "failed" }), node("b@p")]),
    header(),
  )
  expect(verdictOf(tallyOf(run.cells))).toBe("red")
})

test("every node settled and none red is `ok`", () => {
  const run = runOf(
    SEED,
    state([node("a@p", { status: "ok" }), node("b@p", { status: "skipped" })]),
    header(),
  )
  expect(verdictOf(tallyOf(run.cells))).toBe("ok")
})

test("a run with NO nodes has no verdict of any colour", () => {
  // The empty-set trap: `red === 0 && settled === total` is true of nothing at
  // all, and a run still claiming a machine would have read `ok`.
  const run = runOf(SEED, state([]), header())
  expect(verdictOf(tallyOf(run.cells))).toBeNull()
  expect(run.phase).toBe("no_lanes")
})

test("the phase and the lane roster are odu's folds, and a claiming lane says so", () => {
  const run = runOf(
    SEED,
    state([]),
    header({
      lanes: [
        { state: "leased", platform: "x86_64-linux", host: "kolu-ci-9" },
        { state: "claiming", platform: "aarch64-darwin", pool: ["petit", "grand"] },
      ],
    }),
  )
  expect(run.phase).toBe("provisioning")
  expect(run.lanes).toEqual(["x86_64-linux=kolu-ci-9", "aarch64-darwin=…petit/grand"])
})

test("a header nobody published is `unstarted`", () => {
  const run = runOf(SEED, state([]), EMPTY_HEADER)
  expect(run.phase).toBe("unstarted")
})

test("a node named by `order` that the record does not carry is skipped, not drawn hollow", () => {
  const run = runOf(
    SEED,
    state([node("a@p", { status: "ok" })], { order: ["a@p", "ghost@p"] }),
    header(),
  )
  expect(run.cells.map((cell) => cell.id)).toEqual(["a@p"])
  expect(tallyOf(run.cells).total).toBe(1)
})

test("a run GONE is the last reading kept — never a deletion and never a guess", () => {
  const live = runOf(
    SEED,
    state([node("a@p", { status: "ok" }), node("b@p", { status: "running", startedAt: 5 })]),
    header(),
  )
  const gone = wentOf(live)
  expect(gone.live).toBe(false)
  // A coordinator that died mid-run decided nothing. Inventing `red` for it
  // would report an infrastructure death as a test failure — the very
  // classification odu keeps a separate status for.
  expect(verdictOf(tallyOf(gone.cells))).toBeNull()
  expect(gone.cells).toEqual(live.cells)
})
