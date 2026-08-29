/**
 * ODU'S RECORD → OLAI'S ROW. The one place the two vocabularies meet.
 *
 * Everything odu-shaped that olai ever reads goes through this module and
 * comes out as `./wire`'s shapes, which is the whole of `@olai/odu-client`'s
 * boundary claim: a change to odu's contract is a change HERE and stops.
 *
 * THE FOLDS RUN HERE, not in the browser. `STATUS_META` is odu's single home
 * for what a status MEANS — glyph, semantic hue, whether it counts as red —
 * shared by its TUI, its GitHub poster and its `--progress json`, so olai
 * reads that answer rather than restating it. `runPhase` is the same kind of
 * thing one cell over: a fold over the lane roster that odu owns and every
 * face of a run performs identically or not at all.
 *
 * WHAT IS DELIBERATELY NOT PROJECTED. `posting` (GitHub status-posting health)
 * and `nodeLog` (a node's output) are both members of odu's surface that this
 * package can reach and does not carry: nothing in olai draws either, and a
 * field that crosses for nobody is a wire shape with no reader — the rule
 * `@olai/kolu-client`'s `fleet.ts` keeps about padi's record. The log in
 * particular is the interesting deferral: a matrix cell somebody presses could
 * open it, and the day it does the member is a per-node STREAM (a subscription
 * costing a person LOOKING at something), not a field on a cell every lanes
 * outline already holds.
 */

import type {
  NodeState,
  PipelineState,
  RunHeader,
  RunLane,
} from "@odu/run-client/surface"
import { runPhase, STATUS_META } from "@odu/run-client/surface"
import { splitFanId } from "@odu/run-client/nodeId"

import type { CiRun, RunCell, RunTally } from "./wire/index.ts"

/**
 * ONE NODE, projected.
 *
 * The status word travels VERBATIM and its meanings travel BESIDE it. A word
 * odu adds tomorrow has no row in the table this build compiled against, so
 * the lookup is guarded and the unknown word passes through with a neutral
 * reading rather than being folded onto a neighbour — `ok` would be a lie and
 * `failed` would be a different one. That is `@kolu/solid-dockrow`'s
 * `narrowAgentState` rule ("keeps it, prints it, and a reader sees a strange
 * state rather than a blank") applied to a table lookup instead of a guard.
 */
const cellOf = (node: NodeState): RunCell => {
  const meta = STATUS_META[node.status] as typeof STATUS_META[keyof typeof STATUS_META] | undefined
  // odu's own split, not a second `lastIndexOf("@")` here: a node id's format
  // is that module's, and it exports this fold for exactly this reader — "a
  // face that paints the run as a (recipe × platform) matrix splits every id
  // it is handed", in its own words.
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
  }
}

/** The nodes in the run's OWN scheduling order — never olai's. A node named
 *  by `order` that the record does not carry is skipped rather than drawn
 *  hollow: the two arrive in one frame, so a mismatch is a coordinator mid-
 *  edit and the honest drawing is the nodes that exist. */
const cellsOf = (state: PipelineState): ReadonlyArray<RunCell> => {
  const cells: RunCell[] = []
  for (const id of state.order) {
    const node = state.nodes[id]
    if (node !== undefined) cells.push(cellOf(node))
  }
  return cells
}

/** How the nodes have come out — counted over the projected cells, so the
 *  figure a chip shows and the colours a matrix draws are one reading. */
const tallyOf = (cells: ReadonlyArray<RunCell>): RunTally => {
  let settled = 0
  let ok = 0
  let red = 0
  for (const cell of cells) {
    // SETTLED is "not on its way there", which is every status but the two
    // that are — the complement rather than a list of terminal words, so a
    // status odu adds counts as settled by default and a chip does not stall
    // at `9/10` forever on a word this build has not heard of.
    if (cell.status !== "pending" && cell.status !== "running") settled += 1
    if (cell.status === "ok") ok += 1
    if (cell.red) red += 1
  }
  return { total: cells.length, settled, ok, red }
}

/**
 * WHAT THE RUN CAME TO, or `null` while it has not.
 *
 * RED WINS EARLY — a run with a red node is red before its remaining nodes
 * finish, because that is what a reader needs to know and what odu's own
 * verdict says. `ok` waits for every node, which is the asymmetry the words
 * carry honestly: a green claim about work that has not run is the one thing a
 * CI face must never make.
 *
 * A run with NO nodes has no verdict of any colour — a `provisioning` run that
 * has published a roster and nothing else would otherwise read `ok`, which is
 * the empty-set trap the counting form falls into and the reason this is a
 * branch rather than `red === 0 && settled === total`.
 */
const verdictOf = (tally: RunTally): string | null => {
  if (tally.red > 0) return "red"
  if (tally.total === 0) return null
  return tally.settled === tally.total ? "ok" : null
}

/** One lane of the roster as a face names a column: `platform=host` once the
 *  lease resolved, `platform=…` with the pool it is still claiming from
 *  otherwise. Two states of ONE concept, drawn as one word each — odu's own
 *  union says they are not two lists, so this does not make them two. */
const laneOf = (lane: RunLane): string =>
  lane.state === "leased"
    ? `${lane.platform}=${lane.host}`
    : `${lane.platform}=…${lane.pool.length === 0 ? "" : lane.pool.join("/")}`

/**
 * A LIVE RUN, whole — the two cells joined into olai's one row.
 *
 * The two arrive on independent subscriptions and either can come first (odu
 * publishes its header TWICE per run, juspay/odu#84, so a reader that latched
 * the first frame would show a claiming roster for the run's whole life). The
 * caller holds the last of each and re-projects on every frame of either,
 * which is `@olai/kolu-client`'s two-feed arrangement one appliance over: hold
 * them apart, join per row.
 */
export const runOf = (
  seed: { readonly id: string; readonly at: string },
  state: PipelineState,
  header: RunHeader,
): CiRun => {
  const cells = cellsOf(state)
  const tally = tallyOf(cells)
  return {
    id: seed.id,
    at: seed.at,
    live: true,
    name: state.name,
    sha7: state.sha7,
    dirty: state.dirty,
    seq: state.seq ?? null,
    phase: runPhase(header),
    lanes: header.lanes.map(laneOf),
    cells,
    tally,
    verdict: verdictOf(tally),
  }
}

/**
 * THE SAME ROW ONCE THE SOCKET IS GONE — the last verdict, kept.
 *
 * Not a re-read of anything: it is the final projection with `live` turned
 * off. A run whose last frame still had nodes owed keeps a `null` verdict, and
 * that is the honest answer — a coordinator that died mid-run did not decide
 * anything, and inventing `red` for it would report an infrastructure death as
 * a test failure, which is precisely the classification odu keeps a separate
 * status for.
 *
 * IT TAKES NO CLOCK, and it used to. The row carried the instant olai noticed
 * the socket go, and no face ever drew it — the chip and the matrix both say
 * "the socket is gone" in words. A stamp nothing reads is a wire field with no
 * reader (this module's own rule about `posting` and `nodeLog`, one paragraph
 * up), and it was also the joint-distribution lie a flat product hides: the
 * stamp was meaningful exactly when `live` was false, with arm-order the only
 * thing saying so. Deleting it retired a clock threaded through three layers to
 * feed it.
 */
export const wentOf = (run: CiRun): CiRun => ({ ...run, live: false })
