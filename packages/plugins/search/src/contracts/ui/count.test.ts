import { expect, test } from "bun:test"

import { countLine } from "olai-plugin-search/ui/count.ts"

test("a capped answer says how many it drew and how many there were", () => {
  expect(countLine({ drawn: 8, total: 90 })).toBe("8 of 90 matches")
})

test("an answer that fits says nothing at all", () => {
  expect(countLine({ drawn: 3, total: 3 })).toBe(null)
})

test("nothing found says nothing", () => {
  expect(countLine({ drawn: 0, total: 0 })).toBe(null)
})

test("a total that cannot be right is not said out loud", () => {
  expect(countLine({ drawn: 9, total: 2 })).toBe(null)
})
