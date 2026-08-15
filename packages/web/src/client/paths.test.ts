import { expect, test } from "bun:test"

import { sortByPath } from "./paths.ts"

test("files sort the way the directory walk found them", () => {
  expect(sortByPath(["house.olai", "wing/kitchen.olai", "a.olai", "garden.olai"]))
    .toEqual([
      "a.olai",
      "garden.olai",
      "house.olai",
      "wing/kitchen.olai",
    ])
})

// The whole reason this is not `.sort()`: `.` sorts before `/`, so a flat
// compare puts `wing.olai` before `wing/kitchen.olai` while the walk, which
// descends into `wing` when it meets it, puts the nested one first.
test("a subdirectory sorts where descending into it would put it", () => {
  expect(sortByPath(["wing.olai", "wing/kitchen.olai"])).toEqual([
    "wing/kitchen.olai",
    "wing.olai",
  ])
  expect(sortByPath(["a/b/c.olai", "a/b.olai"])).toEqual(["a/b/c.olai", "a/b.olai"])
})

// It takes the collection's key iterator, which is what the caller has.
test("it takes any iterable of paths", () => {
  expect(sortByPath(new Set(["b.olai", "a.olai"]))).toEqual(["a.olai", "b.olai"])
})
