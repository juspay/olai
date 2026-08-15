/**
 * How this suite occupies the machine: how many workers, which ports they
 * may use, and what a spawned olai is allowed to inherit from the host.
 *
 * Cucumber `--parallel` is one process per worker. Each process already has
 * its own `servers` map, browser and scratch copies. What is NOT isolated by
 * that, and used to be shared mutable state across workers, is:
 *
 *   - the kernel's ephemeral port pool (`listen(0)`), so a restart's gap
 *     between kill and re-bind was a port another worker could steal;
 *   - the host's XDG cache / `PADI_SOCKET`, so a cache keyed on the served
 *     path (recall does this) or a padi on the laptop would be one thing
 *     every worker wrote. HOME is left alone (see `isolateEnv`).
 *
 * Ports and env live here. The count lives in `parallelism.js` — cucumber-js
 * loads `cucumber.js` with Node's ESM loader, which cannot import TypeScript,
 * so the profile imports the JS file and this module re-exports it. One
 * formula, two loaders.
 */

import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import type { EventEmitter } from "node:events";

export { defaultWorkers, WORKER_CAP, workerCount } from "./parallelism.js";

/** First port of worker 0's band. High enough to stay off well-known ports,
 *  low enough to stay out of the kernel's ephemeral range, so a `listen(0)`
 *  elsewhere on the box cannot land inside a worker's band. */
export const PORT_BASE = 20_000;

/** Ports reserved for one worker. A worker that has exhausted its band has
 *  leaked servers, not run out of a small number. */
export const PORTS_PER_WORKER = 200;

/** Cucumber numbers workers from 0. Unset means this process is the only
 *  one — a serial run, or a unit test — and it takes band 0. */
export const workerId = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.CUCUMBER_WORKER_ID;
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export interface PortRange {
  readonly lo: number;
  readonly hi: number;
}

/** Half-open `[lo, hi)` this worker may bind. Disjoint from every other
 *  worker's, which is what makes a restart's re-bind unstealable. */
export const portRange = (id: number): PortRange => {
  const lo = PORT_BASE + id * PORTS_PER_WORKER;
  return { lo, hi: lo + PORTS_PER_WORKER };
};

/** `bun-types`' `node:net` is missing EventEmitter's methods. Same gap
 *  `hooks.ts` already names; one copy here so this module does not import
 *  the World. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

const canBind = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    events(probe).once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });

/**
 * A port in this worker's band that nothing is listening on right now.
 *
 * Still racy between the close and the spawn — the kernel can hand the same
 * port to something else in that window — which is why `startServerChild`
 * retries, and why a restart HOLDS its port rather than asking here again.
 */
export const freePortIn = async (range: PortRange): Promise<number> => {
  for (let port = range.lo; port < range.hi; port++) {
    if (await canBind(port)) return port;
  }
  throw new Error(
    `no free port in ${range.lo}–${range.hi - 1} (worker band exhausted)`,
  );
};

/** Bind `port` and keep it, so the kernel cannot hand it to anyone else
 *  between a kill and the replacement's listen. Incoming sockets are
 *  reset: a page reconnecting during the gap must see a refused
 *  connection, not a silent accept from the placeholder. */
export const holdPort = (port: number): Promise<net.Server> =>
  new Promise((resolve, reject) => {
    const holder = net.createServer((socket) => {
      socket.resetAndDestroy();
    });
    holder.unref();
    events(holder).once("error", reject);
    holder.listen(port, "127.0.0.1", () => resolve(holder));
  });

export const releasePort = (holder: net.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    holder.close((cause) => (cause ? reject(cause) : resolve()));
  });

/**
 * The environment a spawned olai is allowed to see.
 *
 * Spreads the host env so PATH and the nix-built binary's own variables
 * still work, then takes back the shared stores: XDG cache (recall and
 * friends), XDG state (which conversation this directory's panel was in),
 * `PADI_SOCKET`, and the git identity variables that would make a scratch
 * repo survey THIS checkout. HOME is left alone: overriding it emptied the
 * server's git/user identity and the apply inverse came back empty, so ⌘Z
 * had nothing to replay.
 *
 * State is SHARED between a scenario's boots and private to that scenario,
 * which is exactly what the memory under test needs: a restarted server is
 * handed the same `stateRoot`, so it can read back what the first one wrote,
 * and no other worker's server can see it.
 *
 * `stateRoot` is the caller's to delete. Both directories are created here.
 * Scratch servers put it *beside* the scratch copy (never inside — that
 * would pollute a `@git:repo` work tree); shared corpus servers put it
 * in a per-worker temp directory.
 */
export const isolateEnv = (
  stateRoot: string,
  extras: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv => {
  const cache = path.join(stateRoot, "cache");
  const state = path.join(stateRoot, "state");
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...extras,
    XDG_CACHE_HOME: cache,
    XDG_STATE_HOME: state,
  };
  delete env.PADI_SOCKET;
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_COMMON_DIR",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ] as const) {
    delete env[key];
  }
  return env;
};
