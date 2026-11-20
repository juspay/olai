import { expect, test } from "bun:test"

import { sameIds } from "./ids.ts"

test("the same ids in the same order are the same question", () => {
  expect(sameIds(["a", "b"], ["a", "b"])).toBe(true)
  expect(sameIds([], [])).toBe(true)
})

test("order is part of the question", () => {
  expect(sameIds(["a", "b"], ["b", "a"])).toBe(false)
})

test("a list that grew or shrank is a different question", () => {
  expect(sameIds(["a"], ["a", "b"])).toBe(false)
  expect(sameIds(["a", "b"], ["a"])).toBe(false)
  expect(sameIds([], ["a"])).toBe(false)
})
