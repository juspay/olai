/**
 * WHERE ONE NODE'S LOG LIVES ON DISK — the wake's sentence wants a path a
 * person (or an agent) can open, and a row carries everything that names it:
 * the checkout it ran in and the run's `sha7`.
 *
 * THE RULE UNDERNEATH IS ODU'S — `.ci/<sha7>/…` — and it is spelled there:
 * `@odu/run-client/nodeId`'s `logPathFor`, shipped with the checkout-targeting
 * PR (juspay/odu#97), is the ONE spelling, written by odu's own coordinator
 * and derived here. What this function adds on top of it is this package's
 * own honesty discipline and nothing else: `PipelineState`'s own comment on
 * `sha7` blesses faces rendering `.ci/<sha7>/…` from surface state rather
 * than re-deriving the sha from git, and a run odu never stamped has no
 * honest path to name at all.
 */

import { logPathFor } from "@odu/run-client/nodeId"

import type { CiRun, RunCell } from "./wire/index.ts"

/**
 * The ABSOLUTE log path of one cell of one run — for a sentence, never for a
 * read: this function names a file it does not open, because the file is
 * odu's to serve and a consumer asking for bytes asks the coordinator (or the
 * agent face's `logs` resource), not the disk.
 *
 * `null` where there is no honest path to name: a run odu never stamped with
 * a sha (the pre-run frames). The caller omits the path for those rather than
 * handing somebody a lie with a file-shaped tail.
 */
export const durableLogPath = (run: CiRun, cell: RunCell): string | null => {
  if (run.sha7 === "") return null
  return `${run.at}/${logPathFor(run.sha7, cell.id)}`
}
