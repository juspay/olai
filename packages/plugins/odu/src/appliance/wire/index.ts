import { Schema } from "effect"

export const OduLink = Schema.Struct({
  status: Schema.Literals(["connected", "absent", "skew"]),
  origin: Schema.String,
  refusal: Schema.NullOr(Schema.String),
  since: Schema.String,
})
export type OduLink = typeof OduLink.Type

export const ODU_UNDIALED: OduLink = {
  status: "absent",
  origin: "",
  refusal: null,
  since: "",
}

export const sameOdu: (a: OduLink, b: OduLink) => boolean = Schema.toEquivalence(OduLink)

export const RunCell = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  platform: Schema.String,
  status: Schema.String,
  hue: Schema.String,
  glyph: Schema.String,
  red: Schema.Boolean,
  startedAt: Schema.NullOr(Schema.Number),
  ms: Schema.NullOr(Schema.Number),
  attempt: Schema.Int,
  host: Schema.NullOr(Schema.String),
  logKey: Schema.String,
})
export type RunCell = typeof RunCell.Type

export interface RunTally {
  readonly total: number
  readonly settled: number
  readonly ok: number
  readonly red: number
}

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

export const liveOf = (state: string): boolean =>
  state === "provisioning" || state === "running"

export const verdictOf = (run: CiRun): string | null => {
  if (run.outcome !== null) return run.outcome
  const tally = tallyOf(run.cells)
  if (tally.red > 0) return "failed"
  if (!settledOf(tally)) return null
  if (run.cells.some((cell) => cell.status === "cancelled")) return "incomplete"
  return "passed"
}

export const CiRun = Schema.Struct({
  id: Schema.String,
  repoRoot: Schema.String,
  name: Schema.String,
  sha7: Schema.String,
  dirty: Schema.Boolean,
  seq: Schema.NullOr(Schema.Int),
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

export const oduMembers = {
  cells: {
    ci: {
      schema: CiRuns,
      default: NO_RUNS,
      verbs: ["get"],
      equals: sameCi,
      arrayKey: "id",
    },
    service: {
      schema: OduLink,
      default: ODU_UNDIALED,
      verbs: ["get"],
      equals: sameOdu,
    },
  },
} as const
