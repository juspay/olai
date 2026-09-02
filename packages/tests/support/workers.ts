/**
 * How this suite occupies the machine: how many workers, how a restart
 * holds its port, and what a spawned olai is allowed to inherit from the
 * host.
 *
 * Cucumber `--parallel` is one process per worker. Each process already has
 * its own `servers` map, browser and scratch copies — including the
 * feature-shared scratches `@share-scratch` opts into, which are per-worker
 * for the same reason the corpus servers are: one olai per directory. After
 * each sharing scenario the tree is restored and the server re-reads, so
 * overlapping writers share too. What is NOT isolated by
 * that, and used to be shared mutable state across workers, is:
 *
 *   - the address a restarted server has to come back on, so the open page
 *     is still pointed at it — {@link holdPort} keeps that port across the
 *     kill. The hold ends before the replacement listens, so the remaining
 *     window is a bet on the ephemeral pool, not a closed gap. A claimed
 *     band below `ip_local_port_range` used to make it structural; that
 *     walk died with the initial bind asking the OS;
 *   - the host's XDG cache / state / runtime / `PADI_SOCKET`, so a cache
 *     keyed on the served path (recall does this), a padi on the laptop, or
 *     the one-brain lock files would be one thing every worker wrote. HOME
 *     is left alone (see `isolateEnv`).
 *
 * Initial binds ask the OS (`--port` omitted; the process default is 0).
 * Two worktrees therefore cannot pick the same number and cannot squat
 * production. The port-band walk this file used to own died with that:
 * a band computed from the worker id put every run's worker 0 on the same
 * two hundred ports, which is the other half of the same defect.
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

/**
 * How a spawned server was configured, as a cache key. Two scenarios that
 * share a scratch must be the same shape of server: a `@kolu` one cannot
 * reuse a server started without it. Lives here with {@link isolateEnv}
 * because the volatility is "what this child is", not "may these scenarios
 * share". Different fingerprints are different slots, not a refusal.
 */
export const spawnFingerprint = (opts: {
  readonly stored: boolean;
  readonly agent: boolean;
  readonly opencode: boolean;
  readonly pi: boolean;
  readonly kolu: boolean;
  readonly git?: string;
  /** The git POLICY this server was started with — `--commit` / `--push`, and
   *  `null` for the flag nobody gave. Part of the key because a pinned server
   *  draws every browser's preference panel differently, so a scenario about a
   *  live toggle may not reuse one. */
  readonly pin?: { readonly commit?: string; readonly push?: string };
  /** The avatar URL template this server was started with, if any. Part of
   *  the key because a server that pictures people from a template answers
   *  `GET /olai/who` differently — a scenario about the rung below it may not
   *  reuse one. */
  readonly avatar?: string;
  /**
   * WHICH PADI this server was pointed at (`@padi:<fleet>`), if any.
   *
   * Part of the key for the sharpest version of this function's whole reason:
   * a server dialed at one padi is showing one FLEET, and a scenario that
   * wants another must not reuse it — it would draw the first scenario's
   * terminals and pass or fail on them.
   *
   * It also stops a `@padi:` server being shared BEYOND its own scenario at
   * all, and that is not a side effect but the point: the padi dies in that
   * scenario's After hook, so the next scenario would inherit a server whose
   * link has gone — a page that draws hollow chips for a reason nothing in
   * the feature says. Each socket is a fresh temp path, so the fingerprint is
   * unique per scenario by construction.
   */
  readonly padiSocket?: string;
  /** WHICH INTEGRATIONS this server composed (`--plugins`), if the scenario
   *  said. Part of the key for the padi socket's reason one field up: a server
   *  running fewer plugins serves a different WIRE — the disabled one's members
   *  are not on it — so a scenario that wants the full set may not reuse one,
   *  and a scenario that wants one off may not be handed a server running it. */
  readonly plugins?: string;
}): string =>

  `stored=${opts.stored ? 1 : 0},agent=${opts.agent ? 1 : 0},opencode=${
    opts.opencode ? 1 : 0
  },pi=${opts.pi ? 1 : 0},kolu=${opts.kolu ? 1 : 0},git=${opts.git ?? "off"}` +
  `,commit=${opts.pin?.commit ?? "-"},push=${opts.pin?.push ?? "-"},avatar=${opts.avatar ?? "-"}` +
  `,padi=${opts.padiSocket ?? "-"},plugins=${opts.plugins ?? "-"}`;

/** Cucumber numbers workers from 0. Unset means this process is the only
 *  one — a serial run, or a unit test. Used to name the per-worker temp
 *  root, not to pick a port. */
export const workerId = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.CUCUMBER_WORKER_ID;
  if (raw === undefined || raw === "") return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** `bun-types`' `node:net` is missing EventEmitter's methods. Same gap
 *  `hooks.ts` already names; one copy here so this module does not import
 *  the World. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

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
 * XDG runtime (the one-brain lock), `PADI_SOCKET`, and the git identity
 * variables that would make a scratch repo survey THIS checkout. HOME is
 * left alone: overriding it emptied the server's git/user identity and the
 * apply inverse came back empty, so ⌘Z had nothing to replay.
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
/** WHERE A SPAWNED SERVER KEEPS WHAT SURVIVES A RESTART — `$XDG_STATE_HOME`,
 *  under the isolation root {@link isolateEnv} is given. */
const stateHomeIn = (stateRoot: string): string =>
  path.join(stateRoot, "state");

export const isolateEnv = (
  stateRoot: string,
  extras: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv => {
  const cache = path.join(stateRoot, "cache");
  const state = stateHomeIn(stateRoot);
  const runtime = path.join(stateRoot, "runtime");
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
  // The identity family is taken off the HOST's copy, before the spawn's own
  // extras go on: a developer whose shell exports the documented avatar
  // template (`OLAI_IDENTITY_AVATAR_TEMPLATE='https://github.com/{login}.png'`)
  // would otherwise hand it to EVERY spawned server, and the scenario that
  // says a login with nothing behind it draws the silhouette would draw a
  // GitHub avatar instead. What a server under test trusts, and pictures
  // people with, is the scenario's (`@avatar-template`, and the headers a
  // step injects) — never the laptop's.
  const host: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(host)) {
    if (key.startsWith("OLAI_IDENTITY_")) delete host[key];
  }
  // WHERE PADI IS goes the same way and for the same reason, one variable over:
  // a developer running kolu would otherwise hand every spawned server their
  // own live padi, and the scenario that says a laptop without kolu draws
  // hollow chips would draw their actual terminals. Taken off the HOST here
  // rather than deleted after `extras`, which is where it used to be — that
  // spelling also deleted the socket a `@padi:` scenario had just spawned, so
  // the tag could not work at all.
  delete host.PADI_SOCKET;
  const env: NodeJS.ProcessEnv = {
    ...host,
    ...extras,
    XDG_CACHE_HOME: cache,
    XDG_STATE_HOME: state,
    // A private runtime directory per spawn, so a scratch vault's lock
    // lands next to that spawn's state and dies with it, rather than in
    // the developer's `$XDG_RUNTIME_DIR/olai` — which is how 151k leftover
    // `.lock` files accumulated there.
    XDG_RUNTIME_DIR: runtime,
  };
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
