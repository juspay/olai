/**
 * Feature-shared scratch copies — the other half of `@scratch:`.
 *
 * A `@scratch:<name>` scenario still means "I write the files I am served".
 * By default that is a private copy and a private server, thrown away with
 * the scenario. Features opt in with `@share-scratch` at the top: every
 * `@scratch:` scenario on this worker shares one copy and one server, and
 * After drains in-flight writes, restores the tree to the fixture, and
 * asks the still-running server to re-read (`POST /olai/resync`).
 * Overlapping writers can share because the next scenario starts from the
 * original corpus, not from the last one's leftovers.
 *
 * Sharing is per worker, never across workers. `--parallel` is one process
 * per worker; one olai per directory is a kernel lock
 * (`packages/server/src/lock.ts`), so two workers over one tree would refuse
 * to boot. Each worker's map is already its own.
 *
 * This module is that contract: the tags, the restore, and the observer that
 * names a restore that did not take. Spawn identity (agent / kolu / git)
 * lives with isolateEnv in `workers.ts` — that volatility is what the child
 * *is*, not whether these scenarios may share.
 *
 * Bytes put back are not a signal the server honours. The store's cheap look
 * is entitled to see nothing in a same-length rewrite that landed in the same
 * second (packages/tests/README.md, the evidence driver's own warning;
 * `@olai/store`'s probe), which is exactly the shape a restore has. So the
 * POST asks the store for its OTHER freshness class — `verified`, "a look you
 * may believe against a tree something outside this process rewrote" — and
 * what that costs the store is the store's business rather than this
 * harness's. It does not return to the next scenario until the probe has
 * published.
 *
 * A restore that cannot put the tree back — leftover files, a missing
 * fixture path — fails naming the scenario and the files. Chat, `@git`,
 * `@kolu`, `@agent-stored`, and a scenario that restarts its server stay
 * private: conversation state lives in the process and in XDG, a git repo
 * is more than the files, and SIGKILL would take the shared server out
 * from under the rest of the feature (`restartGate`).
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** `@share-scratch` on a feature: its `@scratch:` scenarios share one copy
 *  and one server per worker. After each, in-flight writes drain, the tree
 *  is restored to the fixture, and the server re-reads, so overlapping
 *  writers can share. */
export const SHARE_TAG = "@share-scratch";
/** `@own-scratch` on a scenario inside a sharing feature: keep a private
 *  copy, because restore cannot make this one's state true (it restarts
 *  the server, or conversation/git/kolu state lives off the tree).
 *  Meaningless without {@link SHARE_TAG}, and refused. */
export const OWN_TAG = "@own-scratch";

/** `POST` path the shared-scratch After uses to force a re-read. Named
 *  once: the server's route and this harness must agree, and
 *  `scratch.test.ts` pins both spellings. */
export const RESYNC_PATH = "/olai/resync";

const CORPUS_TAG = /^@(corpus|scratch):([A-Za-z0-9_-]+)$/;

/** The corpus a scenario gets when it names none. */
export const DEFAULT_CORPUS = "good";

export type ScratchMode = "corpus" | "own" | "share";

/** The world record a sharing scenario carries: the slot key. Absent means
 *  the copy is private, or there is no copy. The tree hash lives on the
 *  slot (the fixture origin), not here: After restores to that origin
 *  rather than diffing this scenario against the last one. */
export type ScratchShare = {
  readonly key: string;
};

/**
 * A shared scratch must not be restarted: SIGKILL would take the process
 * out from under every other scenario in the feature on this worker.
 * `undefined` is the private-copy path, which may restart.
 */
export const restartGate = (share: ScratchShare | undefined): Error | undefined => {
  if (share === undefined) return undefined;
  return new Error(
    `this scenario restarts the server it is served by, so it must own ` +
      `that server: tag it ${OWN_TAG} rather than sharing (${SHARE_TAG}) — ` +
      `the shared scratch is running for every other scenario in this feature too`,
  );
};

/**
 * A pickle already recorded on this shared slot is a Cucumber retry: the
 * first attempt's writes are still on the tree, so the retry takes a
 * private copy rather than inheriting them.
 */
export const alreadyShared = (
  seenPickles: ReadonlySet<string>,
  pickleId: string,
): boolean => seenPickles.has(pickleId);

export interface ScratchRequest {
  readonly corpus: string;
  readonly mode: ScratchMode;
}

/**
 * Which corpus a scenario asked for, and whether it wants a private copy, a
 * feature-shared copy, or the worker's read-only corpus server.
 *
 * Feature tags are inherited onto every pickle, so `@share-scratch` at the
 * top of a file reaches every scenario in it; `@corpus:` scenarios ignore it.
 */
export const requestOf = (
  tags: ReadonlyArray<{ readonly name: string }>,
): ScratchRequest => {
  const names = tags.map((tag) => tag.name);
  const named = tags.flatMap((tag) => {
    const asked = CORPUS_TAG.exec(tag.name);
    return asked === null
      ? []
      : [{ corpus: asked[2]!, scratch: asked[1] === "scratch" }];
  });
  // TWO CORPORA is the mistake; the SAME corpus twice is not. A feature that
  // serves one corpus read-only (`@corpus:good`) can hold a scenario that
  // needs its own server over that same fixture (`@scratch:good`, because it
  // writes, or because it is started differently) — cucumber hands the
  // feature's tags to every pickle in it, so the scenario cannot take the
  // feature's tag off and is asking for one corpus in two words. A scratch
  // among them wins, on the rule `@pin:` already follows: the more specific
  // tag is the scenario's.
  const corpora = new Set(named.map((ask) => ask.corpus));
  if (corpora.size > 1) {
    throw new Error(
      `a scenario may serve one corpus; this one asks for ${
        [...corpora].join(", ")
      }`,
    );
  }
  const asked = named.length === 0
    ? { corpus: DEFAULT_CORPUS, scratch: false }
    : { corpus: named[0]!.corpus, scratch: named.some((ask) => ask.scratch) };
  const share = names.includes(SHARE_TAG);
  const own = names.includes(OWN_TAG);

  if (own && !share) {
    throw new Error(
      `${OWN_TAG} opts a scenario out of a feature-shared scratch, so the ` +
        `feature must carry ${SHARE_TAG} — without it the tag does nothing.`,
    );
  }
  if (own && !asked.scratch) {
    throw new Error(
      `${OWN_TAG} is a scratch opt-out, so the scenario must also be tagged ` +
        `@scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
    );
  }
  if (!asked.scratch) return { corpus: asked.corpus, mode: "corpus" };
  if (own || !share) return { corpus: asked.corpus, mode: "own" };
  return { corpus: asked.corpus, mode: "share" };
};

/** Content hashes of every file under `root`, paths relative and `/`-spelled. */
export const filesOf = (root: string): Map<string, string> => {
  const out = new Map<string, string>();
  const walk = (dir: string, rel: string): void => {
    let entries: ReadonlyArray<fs.Dirent>;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return;
      throw cause;
    }
    for (const entry of entries) {
      const nextRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, nextRel);
      else if (entry.isFile() || entry.isSymbolicLink()) {
        out.set(
          nextRel,
          createHash("sha256").update(fs.readFileSync(full)).digest("hex"),
        );
      }
    }
  };
  walk(root, "");
  return out;
};

/** Paths whose contents changed, appeared, or disappeared between two walks. */
export const changedFiles = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names]
    .filter((name) => before.get(name) !== after.get(name))
    .sort();
};

/** Whether two content-hash walks are the same tree. */
export const sameTree = (
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>,
): boolean => changedFiles(a, b).length === 0;

/**
 * Put `root` back to `fixture` WITHOUT replacing directory inodes.
 *
 * A recursive watch is armed on the inodes it saw at boot. Deleting `notes/`
 * and copying it back is a new inode; the watcher stays on the old one, and
 * the next scenario's `I rewrite notes/from.html` is a create the store never
 * hears. Files that are extras are removed; fixture files are written in
 * place; directories that exist in both trees stay. Missing `root` is
 * recreated. A scenario that takes the served directory away (the inode
 * itself) still keeps {@link OWN_TAG}.
 */
export const restoreTree = (root: string, fixture: string): void => {
  fs.mkdirSync(root, { recursive: true });
  const want = filesOf(fixture);
  const have = filesOf(root);
  for (const file of have.keys()) {
    if (!want.has(file)) fs.rmSync(path.join(root, file), { force: true });
  }
  for (const file of want.keys()) {
    const dest = path.join(root, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(fixture, file), dest);
  }
};

/** Paths that still differ from `origin` after a restore. Empty is success. */
export const leftovers = (
  origin: ReadonlyMap<string, string>,
  root: string,
): ReadonlyArray<string> => changedFiles(origin, filesOf(root));

/** A restore that did not put the tree back. The loud-refusal that used to
 *  name two overlapping writers: overlapping writes are a clean baseline
 *  now, and this is what stays refused. */
export const unrestoredError = (
  feature: string,
  name: string,
  files: ReadonlyArray<string>,
): Error =>
  new Error(
    `restore of the shared scratch (${SHARE_TAG} on ${feature}) after ` +
      `${JSON.stringify(name)} left ` +
      `${files.map((file) => JSON.stringify(file)).join(", ")} ` +
      `different from the corpus — tag it ${OWN_TAG} if this scenario is ` +
      `one restore cannot put back (a server restart, conversation state, ` +
      `git, kolu), not a faster run`,
  );

/**
 * Ask the still-running server to re-read the restored files. Returns
 * only once in-flight writes have finished and the store's verified look
 * has published — the contract the next scenario's first load needs. Bytes
 * on disk are not that contract.
 */
export const askResync = async (
  baseUrl: string,
  timeoutMs: number,
): Promise<void> => {
  const url = new URL(RESYNC_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `the shared scratch's server did not re-read the restored files ` +
        `(POST ${RESYNC_PATH} → ${response.status}${
          body.trim() === "" ? "" : `: ${body.trim()}`
        })`,
    );
  }
};

/**
 * Put a shared scratch back to its fixture, and do not return until the
 * still-running server has re-read that tree.
 *
 * THE ORDER IS THE CONTRACT. Closing the tab can still have a write in
 * flight — a blur commit, a last key the page sent before the socket
 * dropped — and restoring under that write is how After left
 * `.olai-<pid>-<n>.tmp` on the tree. So: wait until no `run` is in
 * flight (`POST /olai/resync` waits on that before it probes), THEN put
 * the bytes back, THEN ask it to look again. A leftover after the second
 * look is a restore that did not take.
 */
export const restoreShared = async (
  baseUrl: string,
  served: string,
  fixture: string,
  origin: ReadonlyMap<string, string>,
  timeoutMs: number,
): Promise<ReadonlyArray<string>> => {
  await askResync(baseUrl, timeoutMs);
  if (sameTree(filesOf(served), origin)) return [];
  restoreTree(served, fixture);
  await askResync(baseUrl, timeoutMs);
  return leftovers(origin, served);
};
