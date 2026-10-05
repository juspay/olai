import { readJournal, type Journal } from "../journal/index.ts"
import { expect, test } from "bun:test"

import { ledgerSaid } from "./said.ts"

// A journal with something in it, parsed once — the ordinary case the flags
// below are turned on over.
const SAMPLE = `2026-01-05 groceries
    expenses:food    $10
    assets:cash
`
/** A journal with the given reading flags, taken over a real parse rather than
 *  a hand-built bag of fields: the sentences below are about WHAT THE FLAGS
 *  SAY, and the parse is what the flags normally come from. */
const journal = (over: Partial<Journal> = {}): Journal => ({
  ...readJournal(SAMPLE),
  ...over,
})

// THE ORDINARY PAGE says nothing, and that has to be the shape of it: a line
// under every panel saying "showing all of it" is noise that teaches a reader
// to stop reading the line that matters.
test("a page showing the whole file says nothing about what it left out", () => {
  expect(ledgerSaid(journal())).toBeNull()
})

// A file with nothing in it is a fact about the file, not a failure — and it is
// SAID rather than drawn as three empty panels, which a reader has to work out
// by elimination.
test("a file with nothing in it says so", () => {
  expect(ledgerSaid(readJournal(""))).toEqual({
    tone: "aside",
    text: "This file is empty.",
  })
})

// A file with directives but no transactions is NOT empty and gets the
// ordinary nothing rather than the empty sentence.
test("a file with only directives is not called empty", () => {
  expect(ledgerSaid(readJournal("account expenses:food\n"))).toBeNull()
})

// THE TRANSACTION BOUND, said. The count is the bound rather than a total: the
// scan stopped, so how many more there were was never read
// (`../journal/read.ts`).
test("a page that ran out of transaction room says which part it drew", () => {
  expect(ledgerSaid(journal({ moreTransactions: true }))).toEqual({
    tone: "aside",
    text: "Showing the first 1,000 transactions.",
  })
})

// THE LINE BOUND, said, and it says nothing about transactions when only the
// reading stopped being able to see any more of them.
test("a page whose reading was cut says so", () => {
  expect(ledgerSaid(journal({ truncated: true }))).toEqual({
    tone: "aside",
    text: "The file is longer than 20,000 lines; only the beginning was read.",
  })
})

// Both bounds at once are one sentence, in the reading's own order: the
// transactions were counted first, and the lines are what stopped the count.
test("a page that hit both bounds says both, in one sentence", () => {
  expect(ledgerSaid(journal({ moreTransactions: true, truncated: true }))).toEqual({
    tone: "aside",
    text: "Showing the first 1,000 transactions. The file is longer than 20,000 lines; only the beginning was read.",
  })
})

// THE CELL BOUND is its own sentence, because it is a different kind of fact
// from the two above: they say how much of the file was read, this one says a
// field that WAS read was shortened.
test("a page whose long lines were cut says that too", () => {
  expect(ledgerSaid(journal({ longCells: true }))).toEqual({
    tone: "aside",
    text: "Long lines are cut at 2,000 characters.",
  })
  expect(ledgerSaid(journal({ moreTransactions: true, longCells: true }))?.text)
    .toBe("Showing the first 1,000 transactions. Long lines are cut at 2,000 characters.")
})

// An ASIDE and never an alarm, whichever of the moods it is in: nothing was
// refused and nothing failed, so a screen reader is told politely rather than
// interrupted (`@olai/web/client/SaidLine.tsx` owns what a mood means).
test("what it says is an aside, in every mood it has", () => {
  expect(ledgerSaid(readJournal(""))?.tone).toBe("aside")
  expect(ledgerSaid(journal({ moreTransactions: true }))?.tone).toBe("aside")
  expect(ledgerSaid(journal({ truncated: true }))?.tone).toBe("aside")
})
