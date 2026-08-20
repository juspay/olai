import { expect, test } from "bun:test"

import { sameList } from "./lists.ts"

test("the same values in the same places are the same list", () => {
  expect(sameList(["a", "b"], ["a", "b"])).toBe(true)
  expect(sameList([], [])).toBe(true)
})

test("a value added or removed is a different list", () => {
  expect(sameList(["a"], ["a", "b"])).toBe(false)
  expect(sameList(["a", "b"], ["a"])).toBe(false)
})

test("a value swapped for another is a different list", () => {
  expect(sameList(["a", "b"], ["a", "c"])).toBe(false)
})

test("the same values in another order are a different list", () => {
  // The conservative reading, stated here so it is a decision rather than an
  // oversight — see the module header for why neither caller can reach it.
  expect(sameList(["a", "b"], ["b", "a"])).toBe(false)
})
