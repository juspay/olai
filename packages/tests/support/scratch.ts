import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export const SHARE_TAG = "@share-scratch";
export const OWN_TAG = "@own-scratch";

export const RESYNC_PATH = "/olai/resync";

const CORPUS_TAG = /^@(corpus|scratch):([A-Za-z0-9_-]+)$/;

export const DEFAULT_CORPUS = "good";

export type ScratchMode = "corpus" | "own" | "share";

export type ScratchShare = {
  readonly key: string;
};

export const restartGate = (share: ScratchShare | undefined): Error | undefined => {
  if (share === undefined) return undefined;
  return new Error(
    `this scenario restarts the server it is served by, so it must own ` +
      `that server: tag it ${OWN_TAG} rather than sharing (${SHARE_TAG}) — ` +
      `the shared scratch is running for every other scenario in this feature too`,
  );
};

export const alreadyShared = (
  seenPickles: ReadonlySet<string>,
  pickleId: string,
): boolean => seenPickles.has(pickleId);

export interface ScratchRequest {
  readonly corpus: string;
  readonly mode: ScratchMode;
}

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

export const changedFiles = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): ReadonlyArray<string> => {
  const names = new Set([...before.keys(), ...after.keys()]);
  return [...names]
    .filter((name) => before.get(name) !== after.get(name))
    .sort();
};

export const sameTree = (
  a: ReadonlyMap<string, string>,
  b: ReadonlyMap<string, string>,
): boolean => changedFiles(a, b).length === 0;

/**
 * Put `root` back to `fixture` WITHOUT replacing directory inodes.
 *
 * A recursive watch is armed on the inodes it saw at boot, so deleting a
 * directory and copying it back leaves the watcher on the old inode and the
 * next scenario's writes under it are never heard.
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

export const leftovers = (
  origin: ReadonlyMap<string, string>,
  root: string,
): ReadonlyArray<string> => changedFiles(origin, filesOf(root));

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
 * THE ORDER IS THE CONTRACT. So: wait until no `run` is in
 * flight (`POST /olai/resync` waits on that before it probes), THEN put
 * the bytes back, THEN ask it to look again.
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
