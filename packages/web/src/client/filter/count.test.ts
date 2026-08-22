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

import { ANSWERING, countLine, countSaid, type Found, widenSaid } from "./count.ts"

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
/** What the bar is looking at on an ordinary narrowed page — the numbers, and
 *  nothing known yet about the rest of the directory. */
const ON_A_PAGE: Found = { kind: "page", counts: COUNTS, elsewhere: { kind: "unknown" } }

test("rows that answer what is typed are described by the numbers", () => {
  expect(countSaid({ answering: "walnut", failure: null, found: ON_A_PAGE }))
    .toBe("8 of 57")
})

// The rows are one query behind — they hold still, because they are somebody's
// reading — so the NUMBERS are held back instead: a count is a claim about what
// was typed, and "8 of 57" over rows that answer the query before it is the
// arithmetic-from-two-moments this file exists to refuse.
test("rows that answer an older query say so instead of counting", () => {
  expect(countSaid({ answering: null, failure: null, found: ON_A_PAGE }))
    .toBe(ANSWERING)
})

// ...and the wait word is a promise, so it may only be said while something is
// coming. A first query whose call failed has no answer and no answer on the
// way: the failure line beside this one is the news, and `filtering…` left up
// over it would be the page waiting for something nobody is fetching.
test("a failed call says nothing here, because the line below is the news", () => {
  expect(countSaid({ answering: null, failure: "the wire is gone", found: ON_A_PAGE }))
    .toBe(null)
})

// A failure BESIDE an answer keeps the answer: the rows are still the rows the
// server sent for these words, and the call that failed was the next one.
test("a failure after an answer does not take the answer's numbers away", () => {
  expect(countSaid({ answering: "walnut", failure: "the wire is gone", found: ON_A_PAGE }))
    .toBe("8 of 57")
})

// ── the door that widens ──────────────────────────────────────────────
//
// The count is honest about the PAGE and silent about the directory, which is
// the whole complaint this work answers: a reader who typed `#next` into one
// outline had no way of knowing the tag is on four more nodes somewhere else.
// The line below says the difference, and the words after it are the way
// through (docs/brainstorming/one-search-box.md).

test("the widen line says how many more, and is the door to them", () => {
  expect(widenSaid({ kind: "more", many: 12 }))
    .toBe("· 12 more elsewhere — search everywhere")
  expect(widenSaid({ kind: "more", many: 1 }))
    .toBe("· 1 more elsewhere — search everywhere")
})

// "ELSEWHERE" and not "in other files", and the word is load-bearing: what the
// server answers is the COMPLEMENT of what this page draws, which on a zoom
// includes matches in the page's OWN file outside the subtree, and on a day or
// the agenda includes matches in files the page is already drawing rows from.
// Both reviewers of #334 constructed those.
test("the sentence never claims the matches are in another FILE", () => {
  expect(widenSaid({ kind: "more", many: 12 })).not.toContain("file")
})

// The state that used to be silent: a refused call, "nothing yet" and "nothing
// more" all drew no line, so a failed count hid the door and read exactly like
// a page that was the whole answer. The door stays pressable — not knowing how
// much is elsewhere is no reason not to go and look.
test("a count that could not be taken says so, and is still the door", () => {
  expect(widenSaid({ kind: "failed", because: "the wire is gone" }))
    .toBe("· could not count the rest — search everywhere")
})

// The zero rule this file already keeps, read once more — and here it costs
// nothing: the page in front of the reader IS the whole answer, so the door
// leads nowhere new. A number the reader has to take in before they can ignore
// it is worse than no number.
test("nothing elsewhere says nothing at all", () => {
  expect(widenSaid({ kind: "more", many: 0 })).toBe(null)
})

// …and neither does a number nobody has answered yet: the count is a second
// question with a round trip of its own, and "0 more" while waiting would be
// answering it before it had been answered.
test("an unknown count says nothing rather than guessing at zero", () => {
  expect(widenSaid({ kind: "unknown" })).toBe(null)
})

// ── the everywhere page's own sentence ────────────────────────────────
//
// A different sentence about a different subject, and that is the point rather
// than an inconsistency: "3 of 41" is arithmetic about a page somebody was
// already reading, and there is no such denominator here.

test("the everywhere page counts itself instead of counting a page", () => {
  expect(countSaid({
    answering: "#next",
    failure: null,
    found: { kind: "everywhere", said: "5 matches in 3 files" },
  })).toBe("5 matches in 3 files")
})

// The three states a round trip added are the bar's, not the scope's: a page
// waiting to be told is a page waiting to be told wherever it is standing.
test("the everywhere page waits in the same words every page waits in", () => {
  expect(countSaid({
    answering: null,
    failure: null,
    found: { kind: "everywhere", said: "5 matches in 3 files" },
  })).toBe(ANSWERING)
})
