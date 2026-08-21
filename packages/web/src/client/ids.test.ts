/**
 * The law two `equals` guards in this client rest on, pinned.
 *
 * It is `effect`'s array equivalence rather than anything written here, so what
 * these cases are about is the CHOICE and not the implementation: that a
 * re-ordered list is a different question (both callers pair their ids back up
 * with an answer positionally), and that a longer one is too. A guard that
 * quietly said "equal" to either would leave a subscription answering about
 * destinations nobody asked for.
 */

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
