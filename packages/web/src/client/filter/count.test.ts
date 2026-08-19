/**
 * The count line's wording, over every shape three numbers can be in.
 *
 * A sentence rather than a layout, which is why this is a `bun test` and not a
 * scenario: what a browser adds is that the numbers are the page's own
 * (`./narrowing.test.ts` pins that) and that the line is drawn where a reader
 * looks (`packages/tests/features/filter_in_place.feature` pins that). What is
 * pinned HERE is the English — the plural, the dropped word, and the parts that
 * go unsaid.
 */

import { expect, test } from "bun:test"

import { countLine } from "./count.ts"

test("the plain page is the two numbers and nothing else", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 0 }))
    .toBe("8 of 57")
})

// The denominator is the whole point: a query that emptied a page of 57 rows
// and a page that never held one look identical without it.
test("a query that found nothing still says how much there was to find it in", () => {
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 0 }))
    .toBe("no matches of 57")
})

// The three truths at once, which is the line this whole file exists for: what
// matched and is drawn, what the page holds, and what matched and is NOT drawn
// — with the reason, and with where to change it.
test("matches held back are counted, named as matches, and blamed on the switch", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 17 }))
    .toBe("8 of 57 — 17 more matches hidden as done (Prefs)")
})

test("one held-back match is a match, not 1 matches", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 1 }))
    .toBe("8 of 57 — 1 more match hidden as done (Prefs)")
})

// `is:done` typed by a reader who hides finished work: the query found things,
// the page draws none of them, and the line has to say both without saying "3
// MORE matches" than the nothing on screen.
test("nothing drawn and something hidden drops the word `more`", () => {
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 3 }))
    .toBe("no matches of 57 — 3 matches hidden as done (Prefs)")
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 1 }))
    .toBe("no matches of 57 — 1 match hidden as done (Prefs)")
})

// A page with nothing on it is not a special case anywhere upstream, so it must
// not be one here either: the numbers are honestly zero and the sentence says
// so in the words it says everything else in.
test("a page holding nothing says so in the same shape", () => {
  expect(countLine({ shown: 0, held: 0, hiddenAsDone: 0 }))
    .toBe("no matches of 0")
})

