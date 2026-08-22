/**
 * WHAT `/search?q=…` SAYS ABOUT ITS OWN ANSWER.
 *
 * A different sentence from a narrowed page's, and that is the whole of what is
 * asserted here: "3 of 41" is arithmetic about a page somebody was already
 * reading, and there is no such denominator over the directory. Beside that, the
 * two rules every count line in this app keeps — a part that is zero is not
 * said, and a CAP is said out loud rather than drawn in silence.
 */

import { expect, test } from "bun:test"

import { everywhereLine } from "./said.ts"

/** The reading, as much of it as the sentence reads: the two numbers, and the
 *  two lists it takes lengths off. */
const found = (
  matches: number,
  files: number,
  documents = 0,
  drawn = matches,
) => ({
  matches,
  drawn,
  groups: Array.from({ length: files }, () => ({})),
  documents: Array.from({ length: documents }, () => ({})),
})

test("it counts the directory rather than a page", () => {
  expect(everywhereLine(found(12, 3))).toBe("12 matches in 3 files")
  // English, not code: one of something is one.
  expect(everywhereLine(found(1, 1))).toBe("1 match in 1 file")
})

// No denominator, and that is not an omission: on a page the denominator is the
// news ("your query emptied it, and here is what it emptied"), and here the news
// is that the directory holds no answer at all.
test("nothing found is nothing found, with no denominator", () => {
  expect(everywhereLine(found(0, 0))).toBe("no matches")
})

// The other half of the directory, counted apart because a document is not a
// row of a tree — and absent when a query found none, which is the zero rule.
test("documents are counted beside the records, and only when there are any", () => {
  expect(everywhereLine(found(12, 3, 2))).toBe("12 matches in 3 files · 2 documents")
  expect(everywhereLine(found(12, 3, 1))).toBe("12 matches in 3 files · 1 document")
  expect(everywhereLine(found(12, 3, 0))).toBe("12 matches in 3 files")
})

// A query that found ONLY documents still found something, so the pair is
// drawn rather than a sentence that hides half its answer.
test("a query only the documents answered says both halves", () => {
  expect(everywhereLine(found(0, 0, 2))).toBe("no matches · 2 documents")
})

// THE CAP, and this is the assertion the whole "no silent cap" ruling rests on:
// a page drawing two hundred of thirteen hundred rows in silence is the exact
// failure the deleted shortlists were deleted for.
test("a capped answer says what it drew, what it found, and what to do", () => {
  expect(everywhereLine(found(1340, 37, 0, 200)))
    .toBe("200 of 1340 matches in 37 files — narrow the query")
})
