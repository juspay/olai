import { expect, test } from "bun:test"

import { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS, boundedBy, clipFields } from "./bounds.ts"
import { readJournal } from "./read.ts"

// THE CELL BOUND, on any one field — read off the DRAWING and not only off the
// sentence: a page that says "cut" over the whole description would be lying.
// (from `hledger.test.ts`'s "a field longer than the bound is cut, and the cut
// is said")
test("a field longer than the bound is cut, and the cut is said", () => {
  const journal = readJournal(`2026-01-05 ${"x".repeat(40)}\n    a  $1\n    b\n`, { cell: 10 })
  expect(journal.transactions[0]!.description).toBe("x".repeat(10))
  expect(journal.longCells).toBe(true)
})

// The bounds are the ones this module declares, and they are numbers a page can
// say in a sentence. (from "the defaults are the named bounds")
test("the defaults are the named bounds", () => {
  expect([HLEDGER_LINES, HLEDGER_TRANSACTIONS, HLEDGER_CELL]).toEqual([20_000, 1_000, 2_000])
  expect(boundedBy()).toEqual({ lines: 20_000, transactions: 1_000, cell: 2_000 })
  expect(boundedBy({ cell: 5 })).toEqual({ lines: 20_000, transactions: 1_000, cell: 5 })
})

// THE CUT IS ONE PASS OVER FINISHED RECORDS: every field, and the flag, in the
// one place the bound is applied.
test("clipFields cuts a finished read's fields", () => {
  const read = readJournal(`2026-01-05 a very long description  ; a:long tag value\n    a  $1\n    b\n`)
  const clipped = clipFields(read, 4)
  expect(clipped.transactions[0]!.description).toBe("a ve")
  expect(clipped.transactions[0]!.tags).toEqual([{ key: "a", value: "long" }])
  expect(clipped.longCells).toBe(true)
  // The entry text is a field too.
  const withEntry = readJournal(`account ${"x".repeat(50)}\n`)
  expect(clipFields(withEntry, 8).entries[0]!.text).toBe("account ")
})
