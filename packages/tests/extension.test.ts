/**
 * The direct Org2 cutover, held as a repository sweep.
 *
 * Outlines are `.org` files containing Org headings and property drawers.
 * The former `.olai` suffix and JSONL payload are not a compatibility arm:
 * product code must not rediscover either spelling after this POC lands.
 * Migration notes and negative tests may still name the formats they replace.
 */

import { expect, test } from "bun:test"

import { granting, read, tracked, unresolved } from "./support/sweep.ts"

const MAY_NAME_OLD_STORAGE: ReadonlyArray<string> = [
  "docs/format.md",
  "docs/org2-poc.md",
  "docs/running.md",
  "packages/format/src/kinds.test.ts",
]

const TRACKED = tracked(import.meta.filename)
const granted = granting(MAY_NAME_OLD_STORAGE)

const staleClaims = (file: string): boolean => {
  if (granted(file)) return false
  const text = read(file)
  return /one JSON object per line|flat-record JSONL|one enormous line per node|(?:an outline|a \.org) is one line per node/i
    .test(text)
}

test("the sweep is actually reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200)
})

test("every migration grant names a file that exists", () => {
  expect(unresolved(MAY_NAME_OLD_STORAGE)).toEqual([])
})

test("no tracked file still uses the old outline suffix", () => {
  expect(TRACKED.filter((file) => /\.olai(?:$|[.#-])/i.test(file))).toEqual([])
})

test("current code and docs do not describe the retired JSONL representation", () => {
  expect(TRACKED.filter(staleClaims).sort()).toEqual([])
})
