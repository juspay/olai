import { expect, test } from "bun:test"

import { sortByPath } from "./paths.ts"

test("files sort the way the directory walk found them", () => {
  expect(sortByPath(["house.jsonl", "wing/kitchen.jsonl", "a.jsonl", "garden.jsonl"]))
    .toEqual([
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
  expect(sortByPath(["wing.jsonl", "wing/kitchen.jsonl"])).toEqual([
    "wing/kitchen.jsonl",
    "wing.jsonl",
  ])
  expect(sortByPath(["a/b/c.jsonl", "a/b.jsonl"])).toEqual(["a/b/c.jsonl", "a/b.jsonl"])
})

// It takes the collection's key iterator, which is what the caller has.
test("it takes any iterable of paths", () => {
  expect(sortByPath(new Set(["b.jsonl", "a.jsonl"]))).toEqual(["a.jsonl", "b.jsonl"])
})
