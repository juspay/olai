import { expect, test } from "bun:test"

import { tagsIn } from "./tags.ts"

test("a tag value runs to the next comma", () => {
  expect(tagsIn("trip:berlin paid:card, paid:true, note:").tags).toEqual([
    { key: "trip", value: "berlin paid:card" },
    { key: "paid", value: "true" },
    { key: "note", value: null },
  ])
})

test("tags keep their order, and a bare key keeps a null", () => {
  expect(tagsIn("a:1, b:").tags).toEqual([
    { key: "a", value: "1" },
    { key: "b", value: null },
  ])
  expect(tagsIn("no tags here").tags).toEqual([])
})

test("the prose is the comment with its tags taken out", () => {
  expect(tagsIn("recurring:rent").prose).toBe("")
  expect(tagsIn("groceries run trip:berlin, paid:card").prose).toBe("groceries run")
  expect(tagsIn("the deposit trip:berlin").prose).toBe("the deposit")
  expect(tagsIn("bill:utility, autopay:").prose).toBe("")
  expect(tagsIn("just prose, no tags").prose).toBe("just prose, no tags")
  expect(tagsIn("trip:berlin lovely city").prose).toBe("")
})
