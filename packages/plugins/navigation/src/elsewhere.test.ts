import { expect, test } from "bun:test"

import { elsewhereOf, ELSEWHERE_SELECTOR, LINKS_ELSEWHERE } from "./elsewhere.ts"

test("a press in any pane but the first goes into the pane on its left", () => {
  expect(elsewhereOf(1)).toEqual({ kind: "into", index: 0 })
  expect(elsewhereOf(2)).toEqual({ kind: "into", index: 1 })
  expect(elsewhereOf(7)).toEqual({ kind: "into", index: 6 })
})

test("a press in the leftmost pane opens the one to its right", () => {
  expect(elsewhereOf(0)).toEqual({ kind: "beside", from: 0 })
})

test("the selector is the attribute a face marks its subtree with", () => {
  expect(ELSEWHERE_SELECTOR).toBe(`[${LINKS_ELSEWHERE}]`)
})
