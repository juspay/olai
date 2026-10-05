import { expect, test } from "bun:test"

import { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS, boundedBy, clip } from "./bounds.ts"
import { readJournal } from "./read.ts"

// THE CELL BOUND, on any one field — read off the DRAWING and not only off the
// sentence: a page that says "cut" over the whole description would be lying.
//
test("a field longer than the bound is cut, and the cut is said", () => {
  const journal = readJournal(`2026-01-05 ${"x".repeat(40)}\n    a  $1\n    b\n`, { cell: 10 })
  expect(journal.transactions[0]!.description).toBe("x".repeat(10))
  expect(journal.longCells).toBe(true)
})

// The bounds are the ones this module declares, and they are numbers a page can
// say in a sentence.
test("the defaults are the named bounds", () => {
  expect([HLEDGER_LINES, HLEDGER_TRANSACTIONS, HLEDGER_CELL]).toEqual([20_000, 1_000, 2_000])
  expect(boundedBy()).toEqual({ lines: 20_000, transactions: 1_000, cell: 2_000 })
  expect(boundedBy({ cell: 5 })).toEqual({ lines: 20_000, transactions: 1_000, cell: 5 })
})

// THE CUT IS APPLIED WHERE A RECORD IS BUILT, which is what makes the two views
// agree: the account the balances are summed under is the SAME cut string the
// posting draws, so a long account is shortened in both places or in neither.
test("a cut account is the same string in a posting and in the balances", () => {
  const long = "expenses:food:an-account-name-that-runs-on-and-on"
  const journal = readJournal(`2026-01-05 x\n    ${long}  $1\n    assets:cash\n`, { cell: 12 })
  const account = journal.transactions[0]!.postings[0]!.account
  expect(account).toBe(long.slice(0, 12))
  expect(journal.balances.accounts).toContain(account)
  expect([...journal.balances.of.keys()].some((one) => one.startsWith("expenses"))).toBe(true)
  // …and every key is cut, the parents a rollup minted included.
  expect([...journal.balances.accounts].every((one) => one.length <= 12)).toBe(true)
  expect(journal.longCells).toBe(true)
})

// A CUT IN THE MIDDLE OF A PATH LEAVES NO NAMELESS SEGMENT: `assets:bank:chec`
// is a row, and `assets:bank:` would be a node with an empty name.
test("a cut account does not end in a colon", () => {
  const journal = readJournal("2026-01-05 x\n    assets:bank:checking  $1\n    assets:cash\n", { cell: 12 })
  const account = journal.transactions[0]!.postings[0]!.account
  expect(account).toBe("assets:bank")
  expect(journal.balances.accounts).toContain("assets:bank")
  expect([...journal.balances.accounts].some((one) => one.endsWith(":"))).toBe(false)
})

// The cut itself: one function, one witness.
test("clip cuts a field and remembers that it did", () => {
  const witness = { cut: false }
  expect(clip("abcdef", 3, witness)).toBe("abc")
  expect(witness.cut).toBe(true)
  expect(clip("ab", 3, witness)).toBe("ab")
})
