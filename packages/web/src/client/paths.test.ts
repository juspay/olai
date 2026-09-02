import { expect, test } from "bun:test"

import { sortByPath } from "./paths.ts"

test("files sort the way the directory walk found them", () => {
  expect(sortByPath(["house.org", "wing/kitchen.org", "a.org", "garden.org"]))
    .toEqual([
      "a.org",
      "garden.org",
      "house.org",
      "wing/kitchen.org",
    ])
})

// The whole reason this is not `.sort()`: `.` sorts before `/`, so a flat
// compare puts `wing.org` before `wing/kitchen.org` while the walk, which
// descends into `wing` when it meets it, puts the nested one first. It is the
// FORMAT's comparator that says so now (`@olai/format`'s `byPath`), because the
// same order places an arriving file in the view this client patches — the
// sidebar and the corpus are one order or they are two answers about one
// directory.
test("a subdirectory sorts where descending into it would put it", () => {
  expect(sortByPath(["wing.org", "wing/kitchen.org"])).toEqual([
    "wing/kitchen.org",
    "wing.org",
  ])
  expect(sortByPath(["a/b/c.org", "a/b.org"])).toEqual(["a/b/c.org", "a/b.org"])
})

// It takes the collection's key iterator, which is what the caller has.
test("it takes any iterable of paths", () => {
  expect(sortByPath(new Set(["b.org", "a.org"]))).toEqual(["a.org", "b.org"])
})
