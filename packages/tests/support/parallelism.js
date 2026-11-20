import { availableParallelism } from "node:os";

/** @type {number} */
export const WORKER_CAP = 8;

const CORES_PER_WORKER = 4;

/** @param {number} cpus
 *  @returns {number} */
const smallBoxWorkers = (cpus) => Math.max(1, Math.min(4, cpus - 1));

/** @param {number} cpus
 *  @returns {number} */
export const defaultWorkers = (cpus) =>
  Math.min(
    WORKER_CAP,
    Math.max(smallBoxWorkers(cpus), Math.floor(cpus / CORES_PER_WORKER)),
  );

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
