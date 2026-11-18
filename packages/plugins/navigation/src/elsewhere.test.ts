/**
 * WHICH PANE IS "THE OTHER PANE" — the whole of `./elsewhere.ts`'s rule, which
 * is a fact about an index and therefore a table rather than something only a
 * running layout can answer.
 */

import { expect, test } from "bun:test"

import { elsewhereOf, ELSEWHERE_SELECTOR, LINKS_ELSEWHERE } from "./elsewhere.ts"

test("a press in any pane but the first goes into the pane on its left", () => {
  expect(elsewhereOf(1)).toEqual({ kind: "into", index: 0 })
  expect(elsewhereOf(2)).toEqual({ kind: "into", index: 1 })
  expect(elsewhereOf(7)).toEqual({ kind: "into", index: 6 })
})

/** THE LEFTMOST PANE HAS NO LEFT, so the press opens one to its right —
 *  `openRight`'s own reading, which reuses the pane already there and makes
 *  one when there is not. A chat alone in the window therefore grows a column
 *  on the first link and keeps using it afterwards. */
test("a press in the leftmost pane opens the one to its right", () => {
  expect(elsewhereOf(0)).toEqual({ kind: "beside", from: 0 })
})

test("the selector is the attribute a face marks its subtree with", () => {
  expect(ELSEWHERE_SELECTOR).toBe(`[${LINKS_ELSEWHERE}]`)
})
