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
 * AND THE BOX ITSELF, which is the third thing and the one this file learnt
 * last. A worker id is unique inside ONE run and says nothing about the run
 * beside it: two suites started from two worktrees both number their workers
 * from zero, so a band COMPUTED from the id put both of them on the same two
 * hundred ports. So a band is CLAIMED here rather than computed
 * ({@link heldBand}), and the id is only where the search starts.
 *
 * Ports and env live here. The count lives in `parallelism.js` — the profile
 * `cucumber.js` is loaded by cucumber-js's own ESM loader rather than by the
 * suite's, so it imports plain JS and this module re-exports it. One formula,
 * two loaders, and the profile does not depend on whose loader it got.
 */

import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import type { EventEmitter } from "node:events";

export { defaultWorkers, WORKER_CAP, workerCount } from "./parallelism.js";

/** First port of band 0. High enough to stay off well-known ports, low enough
 *  to stay out of the kernel's ephemeral range, so a `listen(0)` elsewhere on
 *  the box cannot land inside a worker's band. */
export const PORT_BASE = 20_000;

/** Ports reserved for one worker. A worker that has exhausted its band has
 *  leaked servers, not run out of a small number. */
export const PORTS_PER_WORKER = 200;

/** How many bands there are — and so how many e2e workers this BOX can carry
 *  at once, across every run on it rather than inside one of them. Four
 *  workers is one suite, and a box several worktrees share runs several.
 *
 *  Sixty bands of two hundred ends at 31999, which is the bound that decides
 *  the number: Linux's `net.ipv4.ip_local_port_range` starts at 32768, and the
 *  whole reason {@link PORT_BASE} is where it is would be given away by a band
 *  that reached into the kernel's own pool. */
export const BANDS = 60;

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

/** Half-open `[lo, hi)` — the `id`th band, as arithmetic. WHICH band a worker
 *  gets is {@link heldBand}'s answer and not this one's: the bands are
 *  disjoint by construction, and the thing that has to be decided at run time
 *  is which of them nobody else is already in. */
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

/** The band this process holds, and the socket that says so — claimed on the
 *  first ask, kept for the life of the process.
 *
 *  `marker` is written and never read, and it is not dead: the socket IS the
 *  claim, so it is never closed, and a name at module scope is how a reader
 *  finds the thing holding this band rather than an anonymous listener inside
 *  a loop. Closing it would hand the band to somebody else mid-run, which is
 *  the whole failure this file is about. */
let held: Promise<PortRange> | undefined;
let marker: net.Server | undefined;

/**
 * The ports this process may bind — CLAIMED, not computed.
 *
 * The claim is the band's FIRST port, bound and kept: a second process that
 * wants the same band gets `EADDRINUSE` from the kernel and walks on to the
 * next one. So the band a worker ends up in is a fact about the whole BOX
 * rather than about this run's worker numbering, and the ports below the
 * marker are its own however many suites are going at once.
 *
 * WHY, measured on a 32-core box (2026-08-16): five suites at once, six rounds
 * each. A worker id is unique inside one run and nowhere else, so all five
 * runs' worker 0 scanned the same band from 20000 — and the ONE thing that
 * cannot survive a stranger in the band is a restart, which has to come back
 * on the SAME port and therefore has a window between `releasePort` and the
 * child's own `listen`. Those thirty runs dropped twenty-seven scenarios and
 * SEVENTEEN of them were this, every one reported as `startOwnServer`'s own
 * sentence ("the restarted server came up on …, not …"). Nothing inside a
 * single run ever collided: its bands were already disjoint, and each worker
 * asks for one port at a time.
 *
 * The search STARTS at the worker's own id, so a box running one suite gets
 * band 0, 1, 2, 3 exactly as it did before this — the assignment a person
 * reads off a port number is unchanged in the ordinary case, and only a box
 * that really has two suites on it sees the higher bands.
 */
export const heldBand = (): Promise<PortRange> => (held ??= claimBand(workerId()));

const claimBand = async (start: number): Promise<PortRange> => {
  const refused: Array<string> = [];
  for (let step = 0; step < BANDS; step++) {
    const band = portRange((start + step) % BANDS);
    try {
      marker = await holdPort(band.lo);
      // The marker is the band's own first port and is NOT handed out: a
      // server on it would be a server on the claim.
      return { lo: band.lo + 1, hi: band.hi };
    } catch (cause) {
      refused.push(`${band.lo}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
  throw new Error(
    `every one of the ${BANDS} port bands from ${PORT_BASE} is claimed, so this ` +
      "worker has nowhere to put its servers — either a great many e2e runs are " +
      "going on this box at once, or an earlier one leaked its markers.\n  " +
      refused.join("\n  "),
  );
};

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
