import { expect, test } from "bun:test";

import { granting, read, tracked, unresolved } from "./support/sweep.ts";

const MAY_SPELL_IT: ReadonlyArray<string> = [
  "website/docs/format.md",
  "packages/format/src/kinds.test.ts",
];

const FORMAT_MD_LINES: ReadonlyArray<string> = [
  "olai reads the suffixes its file kinds claim, and a `.jsonl` is not one of them: it sits in a served directory as an unclaimed file, like a `.txt`. Rename them once, from the directory:",
  `git ls-files '*.jsonl' | while read -r f; do git mv "$f" "\${f%.jsonl}.olai"; done`,
];

const TRACKED = tracked(import.meta.filename);

const granted = granting(MAY_SPELL_IT);

const spelling = (pattern: RegExp): ReadonlyArray<string> =>
  TRACKED
    .filter((file) => !granted(file))
    .filter((file) => pattern.test(read(file)))
    .sort();

test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
});

test("every grant still names a record of the past that is there", () => {
  expect(unresolved(MAY_SPELL_IT)).toEqual([]);
});

test("nothing outside the record of the past spells the old extension", () => {
  expect(spelling(/\.jsonl/i)).toEqual([]);
});

test("no file in the repository is still named with it", () => {
  expect(TRACKED.filter((file) => /\.jsonl/i.test(file))).toEqual([]);
});

test("website/docs/format.md says it only on the lines the grant was written for", () => {
  const said = read("website/docs/format.md")
    .split("\n")
    .filter((line) => /\.jsonl/i.test(line))
    .map((line) => line.trim());
  expect(said).toEqual([...FORMAT_MD_LINES]);
});
