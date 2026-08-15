/**
 * The rename, held as a sweep rather than as a sentence.
 *
 * Outlines are `.olai` files. They were `.jsonl` files, across 174 of them —
 * source, docstrings, fixture names, Gherkin, testids, the website, the
 * home-manager module — and a rename that size has exactly one failure mode:
 * not that it breaks, but that it is 99% done. A survivor is silent. `fileKind`
 * no longer claims the suffix, so a fixture still named `house.jsonl` is a file
 * the server does not serve and a scenario that times out thirty seconds later
 * saying nothing about why; a docstring still describing `.jsonl` is a sentence
 * the next reader believes.
 *
 * So the string is banned across the REPOSITORY, and the ban is what makes the
 * cutover atomic going forward too: a new module written next month with
 * `endsWith(".jsonl")` in it — or a line copied out of git history — fails
 * here, named by file, on the run that introduces it.
 *
 * **The whole repository, not `packages/`.** The first draft swept the source
 * tree, which is where the sweep's own author was looking; the files most
 * likely to keep a stale spelling are the hand-edited ones no test reads —
 * `website/index.html`, `nix/home/module.nix`, `justfile`, the docs. Every one
 * of them is in this diff, and none of them would have been covered.
 *
 * **`git ls-files` is what "a file this repo owns" means here**, and the idiom
 * is the justfile's own (`nix_files`, "so node_modules and .direnv stay out").
 * It is not a cheaper `readdirSync`: a hand walk with a guessed prune list
 * swept `packages/tests/reports/`, the gitignored directory the e2e suite drops
 * full-page failure screenshots into — megabytes of PNG read as UTF-8, growing
 * with how much debugging the machine has done, and invisible because nothing
 * tracks it. Tracked-only also draws the right line on WHEN: an untracked file
 * has not landed, and this is a fence about what lands.
 *
 * **The DOT is the whole pattern.** `JSONL` names the CONTENT format, and the
 * content did not change: one JSON object per line, byte for byte what it was.
 * `format/src/write.ts` explaining that a record is one line "because the format
 * is JSONL" is a true sentence and must stay sayable. What may not appear is
 * `.jsonl` — a file extension, which is the thing that moved.
 *
 * It lives in `@olai/tests` because this is the only package ABOVE all the
 * others. `@olai/format` owns the extension and would be the obvious home, but
 * a sweep there would be the floor reading the client, which is the layering
 * `ops`' own manifest refuses in the other direction. It is a file of its own
 * rather than a sweep inside `web/src/client/claims.test.ts` — the house's
 * canonical shape for this, and where the expectation style below is borrowed
 * from — because that file is built around `CLIENT = import.meta.dirname` and
 * every claim in it is one file's monopoly inside one client. This claim is the
 * repository's.
 *
 * It also does NOT strip comments the way that file does, and the difference is
 * the point rather than an omission: there the claims are about CODE, so prose
 * is free to discuss the spelling it hunts. Here the prose IS the subject.
 */

import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** The repository root — two directories up from this file, which lives in
 *  `packages/tests/`. */
const ROOT = path.dirname(path.dirname(import.meta.dirname));

/**
 * What may still spell it, and why each one may.
 *
 * FOUR of the six are the RECORD OF THE PAST, which this rename does not get to
 * edit: `docs/brainstorming/` holds the decisions and why the alternatives lost
 * — including the argument for this very rename, which is unwritable without
 * the word it argued against — `docs/RCA/` holds incidents as they were
 * diagnosed on the day, and the roadmap and its archive are ledgers whose
 * entries describe PRs that shipped against `.jsonl` files. Rewriting any of
 * them would not tidy history, it would falsify it.
 *
 * The fifth is `@olai/format`'s own `node.test.ts`, which asserts that
 * `fileKind` does not claim the suffix. That is the cutover itself, and it has
 * to be written out to be tested.
 *
 * The sixth is `docs/format.md`, and it is the only one that is about the
 * PRESENT: it carries the migration recipe — the `git mv` line a person runs
 * once on a vault they already have — plus the sentence that says why they have
 * to. That is the entire user-facing story of a cutover with no auto-migration
 * behind it, and it cannot be written without the old spelling.
 *
 * A whole file is more than those two lines need, so {@link FORMAT_MD_LINES}
 * holds the grant to exactly them. The first draft of that guard only asserted
 * the recipe was still PRESENT, which is a weaker claim than it reads as —
 * Grok's review of this PR appended a second current-tense `.jsonl` sentence
 * beside the recipe and watched the fence stay green. Asserting the LINES
 * catches that and keeps the liveness check for free: delete the recipe and the
 * list stops matching.
 *
 * This file is absent from the list because it is excluded outright below: it
 * quotes what it hunts, and a sweep that caught its own net teaches the next
 * reader to weaken the pattern rather than fix the code.
 *
 * A trailing `/` is what makes an entry a DIRECTORY, matched by prefix;
 * everything else is one exact path. The first draft prefix-matched all of
 * them, which quietly granted `docs/format.mdx` and `docs/format.md.bak` too —
 * same review.
 */
const MAY_SPELL_IT: ReadonlyArray<string> = [
  "docs/Archive.olai",
  "docs/RCA/",
  "docs/brainstorming/",
  "docs/format.md",
  "docs/roadmap.olai",
  "packages/format/src/node.test.ts",
];

/** Every line of `docs/format.md` allowed to say it: the recipe, and the
 *  sentence that sends a person to it. */
const FORMAT_MD_LINES: ReadonlyArray<string> = [
  "not read `.jsonl` any more, and a `.jsonl` left in a served directory is simply",
  `git ls-files '*.jsonl' | while read -r f; do git mv "$f" "\${f%.jsonl}.olai"; done`,
];

const SELF = path.relative(ROOT, import.meta.filename);

/** Every file this repository owns, as root-relative `/`-spelled paths. Not
 *  filtered by extension: the point is that NOTHING says it, and a `.feature`,
 *  a `README.md`, an `index.html`, a `.nix` and the justfile are all places the
 *  old spelling actually lived. */
const TRACKED: ReadonlyArray<string> = (() => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  // A sweep that quietly swept nothing is worse than no sweep: it is a green
  // run that checked one file. Anything other than a clean listing is a failure
  // to say out loud, here, rather than an empty array to assert against.
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== SELF);
})();

/** Root-relative paths of every tracked file matching `pattern`, minus the ones
 *  allowed to. A prefix in the list covers a directory; an exact string covers
 *  a file. */
const granted = (file: string): boolean =>
  MAY_SPELL_IT.some((allowed) =>
    allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed
  );

const spelling = (pattern: RegExp): ReadonlyArray<string> =>
  TRACKED
    .filter((file) => !granted(file))
    .filter((file) => pattern.test(fs.readFileSync(path.join(ROOT, file), "utf8")))
    .sort();

// A guard on the sweep itself: a listing that came back short — a `cwd` that
// stopped being a repository, a `-z` that stopped being honoured — would pass
// every assertion below while reading almost nothing. The number is a floor,
// not a count.
test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
});

// The expectation is an EQUALITY to a named list rather than "empty", for
// `claims.test.ts`' reason one package over: a pattern that rotted would report
// an empty list here — a green run that checked nothing — instead of passing
// quietly. So the allowed files must go on MATCHING, and they are excluded from
// the corpus rather than from the expectation to keep that property.
test("nothing outside the record of the past spells the old extension", () => {
  expect(spelling(/\.jsonl/i)).toEqual([]);
});

// The other half, and the one a `git mv` gets wrong rather than a `sed`: a file
// whose NAME still carries it. The e2e fixtures are the corpus every scenario
// runs against, and one left behind is a directory the server serves one file
// short of what the scenario expects.
//
// The same pattern as the content sweep rather than an `endsWith`, because the
// shapes a botched rename actually leaves are `house.jsonl.bak` and
// `house.jsonl.olai` — neither of which ENDS in it, and an outline whose records
// never quote the suffix would sail through the content sweep beside it.
test("no file in the repository is still named with it", () => {
  expect(TRACKED.filter((file) => /\.jsonl/i.test(file))).toEqual([]);
});

// `docs/format.md` is exempted for two lines, and this is what stops the grant
// from covering the rest of the file. Held as the LINES rather than as "the
// recipe is present": that weaker form let a second current-tense sentence in
// beside the recipe with the fence still green, which is how a dual-read
// paragraph or an `endsWith(".jsonl")` snippet would arrive in the spec.
//
// It is also the liveness check, for free — a repository that had dropped the
// recipe is one where a person with a pre-rename vault has nothing to run, and
// the sweep, having granted the file, would be the last thing to notice.
test("docs/format.md says it only on the lines the grant was written for", () => {
  const said = fs
    .readFileSync(path.join(ROOT, "docs/format.md"), "utf8")
    .split("\n")
    .filter((line) => /\.jsonl/i.test(line))
    .map((line) => line.trim());
  expect(said).toEqual(FORMAT_MD_LINES);
});
