import { expect, test } from "bun:test"

import { tagsIn } from "./tags.ts"

// A tag VALUE runs to the next comma or the end of the comment — hledger's own
// rule, which is not the one a whitespace split would pick.
test("a tag value runs to the next comma", () => {
  expect(tagsIn("trip:berlin paid:card, paid:true, note:")).toEqual([
    { key: "trip", value: "berlin paid:card" },
    { key: "paid", value: "true" },
    { key: "note", value: null },
  ])
})

// The order is the order written, and a `key:` with nothing after it is null
// rather than an empty string — the empty string is a value somebody could have
// written.
test("tags keep their order, and a bare key keeps a null", () => {
  expect(tagsIn("a:1, b:")).toEqual([
    { key: "a", value: "1" },
    { key: "b", value: null },
  ])
  expect(tagsIn("no tags here")).toEqual([])
})
