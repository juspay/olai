/**
 * Feature-shared scratch copies — the other half of `@scratch:`.
 *
 * A `@scratch:<name>` scenario still means "I write the files I am served".
 * By default that is a private copy and a private server, thrown away with
 * the scenario, because two scenarios mutating the same file through one
 * live store is a flake. Features whose scenarios write DISJOINT files can
 * opt in: `@share-scratch` at the top of the feature, and every `@scratch:`
 * scenario on this worker shares one copy and one server.
 *
 * Sharing is per worker, never across workers. `--parallel` is one process
 * per worker; one olai per directory is a kernel lock
 * (`packages/server/src/lock.ts`), so two workers over one tree would refuse
 * to boot. Each worker's map is already its own.
 *
 * Collision is OBSERVED, not declared. A `@writes:house.olai` tag can be
 * forgotten, and a forgotten declaration is the silent flake this exists to
 * prevent (HACKING.md: never silently ignore errors). After each sharing
 * scenario the harness hashes the scratch tree and compares it to the
 * previous writers on this worker: if two named scenarios both changed the
 * same path, the run fails naming both and the file. Authors who would
 * collide tag the later scenario `@own-scratch` so it keeps a private copy.
 *
 * Observation sees writes (UI, `writeServed`, the agent, Trash minting). It
 * does not see a scenario that only READS a file another one wrote — so a
 * feature whose early scenarios depend on the original corpus and whose later
 * ones mutate it is not a candidate. Convert only where the writes are
 * disjoint *and* the readers do not care about those files.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** `@share-scratch` on a feature: its `@scratch:` scenarios share one copy
 *  and one server per worker, as long as they write disjoint files. */
export const SHARE_TAG = "@share-scratch";
/** `@own-scratch` on a scenario inside a sharing feature: keep a private
 *  copy, because this one collides (or restarts the server, or lists the
 *  whole vault). Meaningless without {@link SHARE_TAG}, and refused. */
export const OWN_TAG = "@own-scratch";

const CORPUS_TAG = /^@(corpus|scratch):([A-Za-z0-9_-]+)$/;

/** The corpus a scenario gets when it names none. */
export const DEFAULT_CORPUS = "good";

export type ScratchMode = "corpus" | "own" | "share";

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
  if (named.length > 1) {
    throw new Error(
      `a scenario may serve one corpus; this one asks for ${
        named.map((ask) => ask.corpus).join(", ")
      }`,
    );
  }
  const asked = named[0] ?? { corpus: DEFAULT_CORPUS, scratch: false };
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

/**
 * How a spawned server was configured, as a cache key. Two scenarios that
 * share a scratch must be the same shape of server: a `@kolu` one cannot
 * reuse a server that was started without it. Different fingerprints are
 * different shared slots, not a refusal — a mixed feature still shares
 * among the scenarios that match.
 */
export const spawnFingerprint = (opts: {
  readonly stored: boolean;
  readonly agent: boolean;
  readonly kolu: boolean;
  readonly git?: string;
}): string =>
  `stored=${opts.stored ? 1 : 0},agent=${opts.agent ? 1 : 0},kolu=${opts.kolu ? 1 : 0},git=${opts.git ?? "off"}`;

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

export interface ScratchWriter {
  readonly name: string;
  readonly files: ReadonlyArray<string>;
}

/** The earlier writer on this shared scratch whose files overlap `files`. */
export const overlapWith = (
  files: ReadonlyArray<string>,
  previous: ReadonlyArray<ScratchWriter>,
): { readonly writer: ScratchWriter; readonly files: ReadonlyArray<string> } | undefined => {
  for (const writer of previous) {
    const hit = files.filter((file) => writer.files.includes(file));
    if (hit.length > 0) return { writer, files: hit };
  }
  return undefined;
};

/** The refusal a collision is: both scenarios, the files, what to do. */
export const collisionError = (
  feature: string,
  current: string,
  previous: string,
  files: ReadonlyArray<string>,
): Error =>
  new Error(
    `these two scenarios share a scratch (${SHARE_TAG} on ${feature}) and ` +
      `both wrote ${files.map((file) => JSON.stringify(file)).join(", ")}:\n` +
      `  first:  ${previous}\n` +
      `  second: ${current}\n` +
      `tag the later one ${OWN_TAG} so it keeps a private copy, or write a ` +
      `different file — a shared scratch that two scenarios mutate is a ` +
      `flake, not a faster run`,
  );
