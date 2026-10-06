import { expect, test } from "bun:test"

import { tagsIn } from "./tags.ts"

// A tag VALUE runs to the next comma or the end of the comment — hledger's own
// rule, which is not the one a whitespace split would pick.
test("a tag value runs to the next comma", () => {
  expect(tagsIn("trip:berlin paid:card, paid:true, note:").tags).toEqual([
    { key: "trip", value: "berlin paid:card" },
    { key: "paid", value: "true" },
    { key: "note", value: null },
  ])
})

// The order is the order written, and a `key:` with nothing after it is null
// rather than an empty string — the empty string is a value somebody could have
// written.
test("tags keep their order, and a bare key keeps a null", () => {
  expect(tagsIn("a:1, b:").tags).toEqual([
    { key: "a", value: "1" },
    { key: "b", value: null },
  ])
  expect(tagsIn("no tags here").tags).toEqual([])
})

// THE PROSE IS WHAT IS LEFT when the tags are taken out — a page draws the
// comment once, so the tags are not drawn twice (once inside the comment, once
// as pills).
test("the prose is the comment with its tags taken out", () => {
  expect(tagsIn("recurring:rent").prose).toBe("")
  expect(tagsIn("groceries run trip:berlin, paid:card").prose).toBe("groceries run")
  expect(tagsIn("the deposit trip:berlin").prose).toBe("the deposit")
  expect(tagsIn("bill:utility, autopay:").prose).toBe("")
  expect(tagsIn("just prose, no tags").prose).toBe("just prose, no tags")
  // A value runs to the end of the comment, so the words after a tag are ITS
  // value and not prose (hledger's rule, above).
  expect(tagsIn("trip:berlin lovely city").prose).toBe("")
})
