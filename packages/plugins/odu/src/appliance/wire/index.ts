/**
 * ODU'S SLICE OF OLAI'S WIRE — what a reader is told about a CI run, and
 * whether the per-user service is speaking.
 *
 * Two cells: `ci` (the boarded runs) and `service` (the three-state readout).
 * Nothing here imports `@odu/*`. odu's board row and nodes frame are the
 * service's own records; what a chip and a matrix need is a flat projection.
 * The mapping lives in `../project.ts`.
 *
 * THE ENTRY'S OWN FENCE: `@olai/surface` depends on this module, so it may
 * import `effect` and NOTHING ELSE — no `@odu/*`, no `solid-js`, no
 * `@olai/format`. `packages/bundle/src/fence.test.ts` asserts it.
 */

import { Schema } from "effect"

// ── The service readout ───────────────────────────────────────────────────

/**
 * WHETHER THERE IS AN ODU SERVICE, in three states rather than a boolean —
 * kolu's link cell, pointed at the other appliance.
 *
 * `connected` is the quiet face. `absent` is ordinary: olai never starts the
 * service; `odu mcp` bootstraps it, and a conversation holding odu's tools has
 * already brought it up. `skew` is the loud one: two builds that cannot speak.
 */
export const OduLink = Schema.Struct({
  status: Schema.Literals(["connected", "absent", "skew"]),
  /** The origin this olai dials (`ODU_WEB_ORIGIN`, else `127.0.0.1:18440`). */
  origin: Schema.String,
  /** The service's `protocolVersion`, when one has spoken. */
  protocolVersion: Schema.NullOr(Schema.String),
  /** What this build of olai speaks — odu's `SERVICE_CONTRACT_VERSION`. */
  speaks: Schema.String,
  since: Schema.String,
})
export type OduLink = typeof OduLink.Type

/** The seed every face starts at: not yet dialed. Spelled `absent` rather than
 *  given a fourth arm, for `KOLU_UNDIALED`'s reason. */
export const ODU_UNDIALED: OduLink = {
  status: "absent",
  origin: "",
  protocolVersion: null,
  speaks: "",
  since: "",
}

export const sameOdu: (a: OduLink, b: OduLink) => boolean = Schema.toEquivalence(OduLink)

// ── One node of a run ─────────────────────────────────────────────────────

export const RunCell = Schema.Struct({
  /** odu's node id, verbatim: `<namepath>@<platform>`. */
  id: Schema.String,
  name: Schema.String,
  platform: Schema.String,
  status: Schema.String,
  hue: Schema.String,
  glyph: Schema.String,
  red: Schema.Boolean,
  startedAt: Schema.NullOr(Schema.Number),
  ms: Schema.NullOr(Schema.Number),
  /** 1-based; the highest attempt recorded for this node. */
  attempt: Schema.Int,
  /** The machine the work ran on, null while a lane is still claiming one. */
  host: Schema.NullOr(Schema.String),
  /** How to ask for this attempt's output — the encoded log key. */
  logKey: Schema.String,
})
export type RunCell = typeof RunCell.Type

export interface RunTally {
  readonly total: number
  readonly settled: number
  readonly ok: number
  readonly red: number
}

/** THE RUN'S OWN NAME FOR ITSELF — odu's `<name> <sha7>#<seq>+dirty` spelling. */
export const identityOf = (run: CiRun): string =>
  run.sha7 === ""
    ? run.name === "" ? run.id : run.name
    : `${run.name === "" ? run.id : run.name} ${run.sha7}${run.seq === null ? "" : `#${run.seq}`}${run.dirty ? "+dirty" : ""}`

export const tallyOf = (cells: ReadonlyArray<RunCell>): RunTally => {
  let settled = 0
  let ok = 0
  let red = 0
  for (const cell of cells) {
    if (cell.status !== "pending" && cell.status !== "running") settled += 1
    if (cell.status === "ok") ok += 1
    if (cell.red) red += 1
  }
  return { total: cells.length, settled, ok, red }
}

export const settledOf = (tally: RunTally): boolean =>
  tally.total > 0 && tally.settled === tally.total

/** Work still in flight on the board: `provisioning` or `running`. */
export const liveOf = (state: string): boolean =>
  state === "provisioning" || state === "running"

/**
 * WHAT THE RUN CAME TO, in odu's own three words, or `null` while it has not.
 *
 * The board row's `outcome` is the authority where the catalog has one. The
 * fold over cells is the live reading: red wins early as `failed`; a fully
 * settled roster with a cancelled node is `incomplete`; otherwise `passed`.
 * `ended` is gone.
 */
export const verdictOf = (run: CiRun): string | null => {
  if (run.outcome !== null) return run.outcome
  const tally = tallyOf(run.cells)
  if (tally.red > 0) return "failed"
  if (!settledOf(tally)) return null
  if (run.cells.some((cell) => cell.status === "cancelled")) return "incomplete"
  return "passed"
}

// ── The run ───────────────────────────────────────────────────────────────

/**
 * ONE BOARDED RUN, as olai holds it.
 *
 * THE KEY IS THE RUN ID. `id` is the `odu-run` property's value exactly as
 * a receipt spelled it, because the join a chip performs is against the value
 * it is drawing. Where it ran (`repoRoot`) is the service's fact, not the
 * board's.
 *
 * A ROW SURVIVES ITS SETTLE. The catalog remembers a finished run, so a run
 * that settled while olai was not running still draws its verdict. `live` is
 * whether the board still has work in flight (`provisioning` / `running`).
 *
 * A boarded id the service does not know is still a row, with `state` `unknown`.
 */
export const CiRun = Schema.Struct({
  /** The run id, verbatim as the board wrote it — the join key. Also the
   *  `arrayKey` at this depth (cells use `id` for the node). */
  id: Schema.String,
  repoRoot: Schema.String,
  live: Schema.Boolean,
  name: Schema.String,
  sha7: Schema.String,
  dirty: Schema.Boolean,
  seq: Schema.NullOr(Schema.Int),
  /** Board state, verbatim: `provisioning`, `running`, `settled`,
   *  `owner_lost`, `expired` — or `unknown` for a boarded id the service has
   *  not named. */
  state: Schema.String,
  outcome: Schema.NullOr(Schema.String),
  phase: Schema.String,
  lanes: Schema.Array(Schema.String),
  cells: Schema.Array(RunCell),
})
export type CiRun = typeof CiRun.Type

export const CiRuns = Schema.Struct({
  runs: Schema.Array(CiRun),
})
export type CiRuns = typeof CiRuns.Type

export const NO_RUNS: CiRuns = { runs: [] }

export const sameCi: (a: CiRuns, b: CiRuns) => boolean = Schema.toEquivalence(CiRuns)

// ── The members ───────────────────────────────────────────────────────────

export const oduMembers = {
  cells: {
    /**
     * EVERY BOARDED RUN — the live-properties seam's second tenant, keyed by
     * the run id the vault named.
     *
     * `arrayKey: "id"` reaches both arrays — the runs and the nodes inside
     * each — because every element of both carries an `id`.
     */
    ci: {
      schema: CiRuns,
      default: NO_RUNS,
      verbs: ["get"],
      equals: sameCi,
      arrayKey: "id",
    },
    /**
     * WHETHER THERE IS AN ODU SERVICE — the header readout's cell, the same
     * three-state contract kolu's `link` keeps.
     */
    service: {
      schema: OduLink,
      default: ODU_UNDIALED,
      verbs: ["get"],
      equals: sameOdu,
    },
  },
} as const
