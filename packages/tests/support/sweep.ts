/**
 * What a sweep over this repository reads: every file it owns, and the code in
 * one with its prose taken out.
 *
 * Two tests in this package hunt spellings across the tree — `extension.test.ts`
 * bans the extension outlines used to have, `kinds.test.ts` holds the file-kind
 * registry's monopoly — and they were assembling the same corpus twice, down to
 * the same failure message. The invariants below are what make such a sweep
 * honest, and they are the part that must not exist in two copies:
 *
 *   - **`git ls-files` is what "a file this repo owns" means.** The idiom is the
 *     justfile's own (`nix_files`, "so node_modules and .direnv stay out"). It is
 *     not a cheaper `readdirSync`: a hand walk with a guessed prune list swept
 *     `packages/tests/reports/`, the gitignored directory the e2e suite drops
 *     full-page failure screenshots into — megabytes of PNG read as UTF-8,
 *     growing with how much debugging the machine has done, and invisible
 *     because nothing tracks it. Tracked-only also draws the right line on WHEN:
 *     an untracked file has not landed, and these are fences about what lands.
 *   - **A listing that came back short must fail loudly**, not quietly sweep
 *     nothing. Anything other than a clean `git ls-files` throws here rather
 *     than becoming an empty array every assertion downstream would pass.
 *   - **A sweep never reads itself.** Each of these files quotes what it hunts,
 *     and one that caught its own net would teach the next reader to weaken the
 *     pattern rather than fix the code.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** The repository root — two directories up from this file, which lives in
 *  `packages/tests/support/`. */
export const ROOT = path.dirname(path.dirname(path.dirname(import.meta.dirname)));

/**
 * Every file this repository owns, as root-relative `/`-spelled paths, minus
 * the sweep asking. Not filtered by extension: what a caller wants differs, and
 * "everything tracked" is the only honest starting point — a `.feature`, a
 * `README.md`, an `index.html`, a `.nix` and the justfile are all places a
 * stale spelling actually lived.
 *
 * `self` is the caller's own `import.meta.filename`.
 */
export const tracked = (self: string): ReadonlyArray<string> => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  const mine = path.relative(ROOT, self);
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== mine);
};

/** One file's text, with its comments removed — for a sweep whose claim is
 *  about CODE, so prose stays free to discuss the spelling being hunted.
 *
 *  `@olai/web`'s `claims.test.ts` stripper, and deliberately the same one: a
 *  line comment is only taken when `//` opens the line or follows whitespace,
 *  so a `https://…` inside a string survives. The cost is a comment pasted
 *  mid-expression surviving too, which for a sweep means a false alarm a human
 *  reads, never a silent pass. */
export const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

/** A tracked file's contents. */
export const read = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), "utf8");
