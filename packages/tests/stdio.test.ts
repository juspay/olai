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
 * files have not landed; this is a fence about what lands. The listing, that
 * guarantee and the grant rule are `./support/sweep.ts`', shared with the two
 * sweeps next door rather than spelled a third time.
 *
 * The RECORD OF THE PAST may still say it: `docs/brainstorming/` holds the
 * decisions and why the alternatives lost — including the argument for the
 * face this sweep retires — `docs/RCA/` holds incidents as they were
 * diagnosed, and the roadmap and `_olai/Trash.olai` are ledgers whose entries
 * describe PRs that shipped the subcommand. Rewriting any of them would
 * not tidy history, it would falsify it.
 *
 * This file is excluded outright: it quotes what it hunts.
 */

import { expect, test } from "bun:test";

import { exists, granting, read, tracked, unresolved } from "./support/sweep.ts";

/** The record of the past, as paths. A const rather than an argument spelled
 *  inline, so the test below can ask whether every one of them still names
 *  something — a grant that has gone stale is a fence closing on the ledger it
 *  was written to excuse, which is exactly what `docs/roadmap.olai` becoming a
 *  directory did to this sweep. */
const MAY_SPELL_IT: ReadonlyArray<string> = [
  "docs/_olai/Trash.olai",
  "docs/RCA/",
  "docs/brainstorming/",
  "docs/lowy-electricity/",
  "docs/roadmap/",
];

const granted = granting(MAY_SPELL_IT);

const TRACKED = tracked(import.meta.filename);

const spelling = (pattern: RegExp): ReadonlyArray<string> =>
  TRACKED
    .filter((file) => !granted(file))
    // `exists` first: `git ls-files` still names a path that is deleted in the
    // work tree until the deletion is staged, and a missing file cannot spell
    // anything.
    .filter((file) => exists(file) && pattern.test(read(file)))
    .sort();

test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
});

test("every grant still names a record of the past that is there", () => {
  expect(unresolved(MAY_SPELL_IT)).toEqual([]);
});

test("nothing outside the record of the past spells the retired stdio face", () => {
  expect(spelling(/olai mcp/)).toEqual([]);
});
