import { expect, test } from "bun:test"

import { ANSWERING, countLine, countSaid } from "./count.ts"

test("the plain page is the two numbers and nothing else", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 0 }))
    .toBe("8 of 57")
})

test("a query that found nothing still says how much there was to find it in", () => {
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 0 }))
    .toBe("No matches of 57")
})

test("matches held back are counted, named as matches, and blamed on the switch", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 17 }))
    .toBe("8 of 57 — 17 more matches hidden as done")
})

test("one held-back match is a match, not 1 matches", () => {
  expect(countLine({ shown: 8, held: 57, hiddenAsDone: 1 }))
    .toBe("8 of 57 — 1 more match hidden as done")
})

test("nothing drawn and something hidden drops the word `more`", () => {
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 3 }))
    .toBe("No matches of 57 — 3 matches hidden as done")
  expect(countLine({ shown: 0, held: 57, hiddenAsDone: 1 }))
    .toBe("No matches of 57 — 1 match hidden as done")
})


const COUNTS = { shown: 8, held: 57, hiddenAsDone: 0 }

test("rows that answer what is typed are described by the numbers", () => {
  expect(countSaid({ answering: "walnut", failure: null, counts: COUNTS }))
    .toBe("8 of 57")
})

test("rows that answer an older query say so instead of counting", () => {
  expect(countSaid({ answering: null, failure: null, counts: COUNTS }))
    .toBe(ANSWERING)
})

test("a failed call says nothing here, because the line below is the news", () => {
  expect(countSaid({ answering: null, failure: "the wire is gone", counts: COUNTS }))
    .toBe(null)
})

test("a failure after an answer does not take the answer's numbers away", () => {
  expect(countSaid({ answering: "walnut", failure: "the wire is gone", counts: COUNTS }))
    .toBe("8 of 57")
})
