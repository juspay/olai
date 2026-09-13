/**
 * ODU'S RECORD → OLAI'S ROW. The one place the two vocabularies meet.
 *
 * A board row plus an optional nodes frame become a `CiRun`. Settled runs
 * cost nothing beyond the row; a live run's cells, phase and lanes come from
 * the frame. A boarded id the service has not named becomes an `unknown` row.
 */

import type { NodesFrame, RunLane, RunNode, RunRow } from "@odu/service-client/surface"
import { STATUS_META } from "@odu/service-client/surface"
import { splitFanId } from "@odu/run-client/nodeId"

import { type CiRun, liveOf, type RunCell } from "./wire/index.ts"

const sha7Of = (sha: string): string => sha.slice(0, 7)

const laneOf = (lane: RunLane): string =>
  lane.state === "leased"
    ? `${lane.platform}=${lane.host}`
    : `${lane.platform}=…${lane.pool.length === 0 ? "" : lane.pool.join("/")}`

const cellOf = (node: RunNode): RunCell => {
  const meta = STATUS_META[node.status] as typeof STATUS_META[keyof typeof STATUS_META] | undefined
  const split = splitFanId(node.id)
  return {
    id: node.id,
    name: split.namepath,
    platform: split.platform,
    status: node.status,
    hue: meta?.hue ?? "grey",
    glyph: meta?.glyph ?? "·",
    red: meta?.isRed ?? false,
    startedAt: node.startedAt,
    ms: node.durationMs,
    attempt: node.attempt,
    host: node.host,
    logKey: node.logKey,
  }
}

const cellsOf = (frame: NodesFrame): ReadonlyArray<RunCell> => {
  const byId = new Map(frame.nodes.map((node) => [node.id, node]))
  const cells: Array<RunCell> = []
  for (const id of frame.order) {
    const node = byId.get(id)
    if (node !== undefined) cells.push(cellOf(node))
  }
  return cells
}

/** A boarded id the service does not know. */
export const unknownOf = (id: string): CiRun => ({
  id,
  repoRoot: "",
  live: false,
  name: "",
  sha7: "",
  dirty: false,
  seq: null,
  state: "unknown",
  outcome: null,
  phase: "",
  lanes: [],
  cells: [],
})

/** A LIVE or SETTLED run, joined from the board row and the latest frame. */
export const runOf = (row: RunRow, frame: NodesFrame | undefined): CiRun => ({
  id: row.runId,
  repoRoot: row.repoRoot,
  live: liveOf(row.state),
  name: row.pipeline,
  sha7: sha7Of(row.sha),
  dirty: row.dirty,
  seq: row.seq,
  state: row.state,
  outcome: row.outcome,
  phase: frame?.env.phase ?? "",
  lanes: frame?.env.lanes.map(laneOf) ?? [],
  cells: frame === undefined ? [] : cellsOf(frame),
})
