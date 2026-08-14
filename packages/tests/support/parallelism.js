/**
 * How many Cucumber workers this run should start.
 *
 * Lives in plain JS because `cucumber.js` is loaded by cucumber-js's own
 * (Node) ESM loader, which cannot import TypeScript. `workers.ts` re-exports
 * these so the pins and the profile cannot drift.
 */

import { availableParallelism } from "node:os";

/** Past this, another Chromium + its olai children costs more than it
 *  saves. Each worker is a browser plus a handful of olai processes;
 *  four was already green under `CUCUMBER_PARALLEL=4`, and eight starved
 *  keystrokes (⌘Z landing in a picker or a draft that had not yet gone).
 *  A 64-core CI box is not a reason to spawn 63 browsers. */
/** @type {number} */
export const WORKER_CAP = 4;

/** `os.availableParallelism()` minus one, floored at 1, capped at
 *  {@link WORKER_CAP}.
 *
 *  Minus one leaves a core for the kernel, the compositor, and this
 *  coordinator process — a 2-core box still runs, serially, rather than
 *  fighting itself. The cap is the other bound: see {@link WORKER_CAP}. */
/** @param {number} cpus
 *  @returns {number} */
export const defaultWorkers = (cpus) =>
  Math.max(1, Math.min(WORKER_CAP, cpus - 1));

/**
 * How many Cucumber workers this run should start.
 *
 * `CUCUMBER_PARALLEL` is the override, including `=1` for a serial run.
 * Unset (or empty) derives from the machine. A value that is not a positive
 * integer is a setup mistake and is refused rather than silently becoming
 * serial (`parseInt("no")` is `NaN`, and `NaN > 1` is how that used to hide).
 */
/** @param {NodeJS.ProcessEnv} [env]
 *  @param {() => number} [available]
 *  @returns {number} */
export const workerCount = (
  env = process.env,
  available = availableParallelism,
) => {
  const raw = env.CUCUMBER_PARALLEL;
  if (raw !== undefined && raw !== "") {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(
        `CUCUMBER_PARALLEL must be a positive integer, got ${JSON.stringify(raw)}`,
      );
    }
    return n;
  }
  return defaultWorkers(available());
};
