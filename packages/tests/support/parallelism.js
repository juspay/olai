/**
 * How many Cucumber workers this run should start.
 *
 * Lives in plain JS because `cucumber.js` is loaded by cucumber-js's own ESM
 * loader — the one loader here that is not the suite's, and the one that need
 * not read TypeScript. `workers.ts` re-exports these so the pins and the
 * profile cannot drift.
 */

import { availableParallelism } from "node:os";

/** The most workers any box gets — a wide box takes more of them, never
 *  dozens: each worker is a browser plus a handful of olai processes.
 *
 *  Measured on a 16-core box, shard 1/6: four workers took 350s and eight took
 *  294s, with every scenario 64% longer — the same work over twice the workers,
 *  a saturated machine. So the count moves with cores, but only this far. */
/** @type {number} */
export const WORKER_CAP = 8;

/** Where the derivation anyone recognises stops: cores minus one, at most
 *  four. Minus one leaves a core for the kernel, the compositor and this
 *  coordinator process — a 2-core box still runs, serially, rather than
 *  fighting itself. Sixteen cores is the arm that keeps four: eight workers
 *  there were green and every scenario 64% slower for a 56s slice gain, which
 *  is a saturated box rather than a faster one. */
const SMALL_BOX_CAP = 4;

/** Cores per worker for a box too big for the rule above: a 32-core CI box at
 *  four workers is a box three quarters idle, so `cpus / 4` is a floor the
 *  derivation raises the ordinary count to when it is the larger — 8 at 32
 *  cores, and 8 rather than 15 at 64. */
const CORES_PER_WORKER = 4;

/** The derivation a laptop and every box up to 16 cores gets. */
/** @param {number} cpus
 *  @returns {number} */
const smallBoxWorkers = (cpus) =>
  Math.max(1, Math.min(SMALL_BOX_CAP, cpus - 1));

/** How many workers to start on a machine of `cpus` cores: the ordinary
 *  derivation, or one per {@link CORES_PER_WORKER} cores when that is larger,
 *  capped at {@link WORKER_CAP}. Nothing changes at or below 16 cores. */
/** @param {number} cpus
 *  @returns {number} */
export const defaultWorkers = (cpus) =>
  Math.min(
    WORKER_CAP,
    Math.max(smallBoxWorkers(cpus), Math.floor(cpus / CORES_PER_WORKER)),
  );

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
