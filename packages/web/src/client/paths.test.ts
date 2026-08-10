import { expect, test } from "bun:test"

import { byPath } from "./paths.ts"

test("files sort the way the directory walk found them", () => {
  const found = ["house.jsonl", "wing/kitchen.jsonl", "a.jsonl", "garden.jsonl"]
  expect([...found].sort(byPath)).toEqual([
    "a.jsonl",
    "garden.jsonl",
    "house.jsonl",
    "wing/kitchen.jsonl",
  ])
})

// The whole reason this is not `.sort()`: `.` sorts before `/`, so a flat
// compare puts `wing.jsonl` before `wing/kitchen.jsonl` while the walk, which
// descends into `wing` when it meets it, puts the nested one first.
test("a subdirectory sorts where descending into it would put it", () => {
  expect([...["wing.jsonl", "wing/kitchen.jsonl"]].sort(byPath)).toEqual([
    "wing/kitchen.jsonl",
    "wing.jsonl",
  ])
  expect(["a/b/c.jsonl", "a/b.jsonl"].sort(byPath)).toEqual(["a/b/c.jsonl", "a/b.jsonl"])
})
