import { expect, test } from "bun:test";

import { exists, read, tracked } from "./support/sweep.ts";

const TRACKED = tracked(import.meta.filename);

const spelling = (pattern: RegExp): ReadonlyArray<string> =>
  TRACKED
    .filter((file) => exists(file) && pattern.test(read(file)))
    .sort();

test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200);
});

test("nothing outside the record of the past spells the retired stdio face", () => {
  expect(spelling(/olai mcp/)).toEqual([]);
});
