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

import { ANSWERING, countLine, countSaid } from "./count.ts"

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


// ── the three states a round trip added ───────────────────────────────
//
// The line under the box is one element and one decision, and each of these was
// a way to lie with it. `countSaid` is where the decision lives so that a test
// can ask; the bar draws whatever it says.

const COUNTS = { shown: 8, held: 57, hiddenAsDone: 0 }

test("rows that answer what is typed are described by the numbers", () => {
  expect(countSaid({ answering: "walnut", failure: null, offline: null, counts: COUNTS }))
    .toBe("8 of 57")
})

// The rows are one query behind — they hold still, because they are somebody's
// reading — so the NUMBERS are held back instead: a count is a claim about what
// was typed, and "8 of 57" over rows that answer the query before it is the
// arithmetic-from-two-moments this file exists to refuse.
test("rows that answer an older query say so instead of counting", () => {
  expect(countSaid({ answering: null, failure: null, offline: null, counts: COUNTS }))
    .toBe(ANSWERING)
})

// ...and the wait word is a promise, so it may only be said while something is
// coming. A first query whose call failed has no answer and no answer on the
// way: the failure line beside this one is the news, and `filtering…` left up
// over it would be the page waiting for something nobody is fetching.
test("a failed call says nothing here, because the line below is the news", () => {
  expect(countSaid({ answering: null, failure: "the wire is gone", offline: null, counts: COUNTS }))
    .toBe(null)
})

// A failure BESIDE an answer keeps the answer: the rows are still the rows the
// server sent for these words, and the call that failed was the next one.
test("a failure after an answer does not take the answer's numbers away", () => {
  expect(countSaid({ answering: "walnut", failure: "the wire is gone", offline: null, counts: COUNTS }))
    .toBe("8 of 57")
})

// ...and the same for the step before a failure: a wire that cannot carry a
// question is not one somebody is waiting on. The box is inert and the pill's
// words are already under it (`./FilterBar.tsx`).
test("a dead wire says nothing here either, for the failure's reason", () => {
  expect(countSaid({
    answering: null,
    failure: null,
    offline: "the connection dropped and is being retried",
    counts: COUNTS,
  })).toBe(null)
})
