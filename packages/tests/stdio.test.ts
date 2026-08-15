/**
 * The stdio face is gone, held as a sweep rather than as a sentence.
 *
 * `olai web` is the one brain. Agents dial `/mcp` over HTTP. The retired
 * spelling is the subcommand that used to start a second store — and a
 * survivor is silent: a docstring still describing how to launch it, a
 * justfile comment still offering it, a website snippet still teaching
 * `claude mcp add -- olai …`. So the string is banned across the repository,
 * and the ban is what makes the cutover atomic going forward too.
 *
 * **The whole repository, not `packages/`.** Same argument as
 * `extension.test.ts`: the files most likely to keep a stale spelling are
 * the hand-edited ones no test reads.
 *
 * **`git ls-files` is what "a file this repo owns" means here.** Untracked
 * files have not landed; this is a fence about what lands.
 *
 * The RECORD OF THE PAST may still say it: `docs/brainstorming/` holds the
 * decisions and why the alternatives lost — including the argument for the
 * face this sweep retires — `docs/RCA/` holds incidents as they were
 * diagnosed, and the roadmap and its archive are ledgers whose entries
 * describe PRs that shipped the subcommand. Rewriting any of them would
 * not tidy history, it would falsify it.
 *
 * This file is excluded outright: it quotes what it hunts.
 */

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.dirname(path.dirname(import.meta.dirname));

const MAY_SPELL_IT: ReadonlyArray<string> = [
  "docs/Archive.olai",
  "docs/RCA/",
  "docs/brainstorming/",
  "docs/lowy-electricity/",
  "docs/roadmap.olai",
];

const SELF = path.relative(ROOT, import.meta.filename);

const TRACKED: ReadonlyArray<string> = (() => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== SELF);
})();

const granted = (file: string): boolean =>
  MAY_SPELL_IT.some((allowed) =>
    allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed
  );

const spelling = (pattern: RegExp): ReadonlyArray<string> =>
  TRACKED
    .filter((file) => !granted(file))
    .filter((file) => {
      const full = path.join(ROOT, file)
      // `git ls-files` still names a path that is deleted in the work tree
      // until the deletion is staged. A missing file cannot spell anything.
      return fs.existsSync(full) && pattern.test(fs.readFileSync(full, "utf8"))
    })
    .sort();

test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
});

test("nothing outside the record of the past spells the retired stdio face", () => {
  expect(spelling(/olai mcp/)).toEqual([]);
});
