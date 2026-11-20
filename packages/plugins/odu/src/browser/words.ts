import {
  type CiRun,
  identityOf,
  liveOf,
  type RunCell,
  type RunTally,
  tallyOf,
  verdictOf,
} from "olai-plugin-odu/appliance/wire"

export type Ticking = (elapsedMs: number) => string

export type CiTone = "going" | "ok" | "red" | "quiet"

export interface CiWords {
  readonly text: string
  readonly tone: CiTone
  readonly title: string
}

export const runningIn = (run: CiRun): RunCell | undefined =>
  run.cells.find((cell) => cell.status === "running")

const countOf = (tally: RunTally): string | undefined =>
  tally.total === 0 ? undefined : `${tally.ok}/${tally.total} ok`

const whatOf = (
  run: CiRun,
  verdict: string | null,
  now: number,
  ticking: Ticking,
): string => {
  if (run.state === "unknown") return "unknown run"
  if (run.state === "owner_lost") return "owner lost"
  if (!liveOf(run.state)) return verdict ?? "incomplete"
  const running = runningIn(run)
  if (running !== undefined) {
    return running.startedAt === null
      ? running.name
      : `${running.name} ${ticking(now - running.startedAt)}`
  }
  if (run.phase !== "") return run.phase
  return verdict ?? "waiting"
}

const toneOf = (run: CiRun, tally: RunTally, verdict: string | null): CiTone => {
  if (tally.red > 0 || verdict === "failed") return "red"
  if (verdict === "passed") return "ok"
  if (!liveOf(run.state)) return "quiet"
  return "going"
}

const titleOf = (run: CiRun): string => {
  const which = identityOf(run)
  const lanes = run.lanes.length === 0 ? "" : ` · ${run.lanes.join(" ")}`
  const where = run.repoRoot === "" ? "Unknown checkout" : run.repoRoot
  const state = run.state === "unknown"
    ? "Unknown run"
    : liveOf(run.state)
    ? "Running"
    : run.state === "owner_lost"
    ? "Stopped unexpectedly"
    : "Finished"
  return `${which} · ${run.id}${lanes} · ${state} · ${where}`
}

export const wordsFor = (
  run: CiRun,
  now: number,
  ticking: Ticking,
): CiWords => {
  const tally = tallyOf(run.cells)
  const verdict = verdictOf(run)
  const count = countOf(tally)
  return {
    text: `ci · ${whatOf(run, verdict, now, ticking)}${
      count === undefined ? "" : ` · ${count}`
    }`,
    tone: toneOf(run, tally, verdict),
    title: titleOf(run),
  }
}
