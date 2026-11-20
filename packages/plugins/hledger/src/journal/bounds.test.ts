import { expect, test } from "bun:test"

import { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS, accountKeyAfterCut, boundedBy, clip } from "./bounds.ts"
import { readJournal } from "./read.ts"

test("a field longer than the bound is cut, and the cut is said", () => {
  const journal = readJournal(`2026-01-05 ${"x".repeat(40)}\n    a  $1\n    b\n`, { cell: 10 })
  expect(journal.transactions[0]!.description).toBe("x".repeat(10))
  expect(journal.longCells).toBe(true)
})

test("the defaults are the named bounds", () => {
  expect([HLEDGER_LINES, HLEDGER_TRANSACTIONS, HLEDGER_CELL]).toEqual([20_000, 1_000, 2_000])
  expect(boundedBy()).toEqual({ lines: 20_000, transactions: 1_000, cell: 2_000 })
  expect(boundedBy({ cell: 5 })).toEqual({ lines: 20_000, transactions: 1_000, cell: 5 })
})

test("a cut account is the same string in a posting and in the balances", () => {
  const long = "expenses:food:an-account-name-that-runs-on-and-on"
  const journal = readJournal(`2026-01-05 x\n    ${long}  $1\n    assets:cash\n`, { cell: 12 })
  const account = journal.transactions[0]!.postings[0]!.account
  expect(account).toBe(long.slice(0, 12))
  expect(journal.balances.accounts).toContain(account)
  expect([...journal.balances.of.keys()].some((one) => one.startsWith("expenses"))).toBe(true)
  expect([...journal.balances.accounts].every((one) => one.length <= 12)).toBe(true)
  expect(journal.longCells).toBe(true)
})

test("a cut account does not end in a colon", () => {
  const journal = readJournal("2026-01-05 x\n    assets:bank:checking  $1\n    assets:cash\n", { cell: 12 })
  const account = journal.transactions[0]!.postings[0]!.account
  expect(account).toBe("assets:bank")
  expect(journal.balances.accounts).toContain("assets:bank")
  expect([...journal.balances.accounts].some((one) => one.endsWith(":"))).toBe(false)
})

test("clip says what it kept and whether it cut", () => {
  expect(clip("abcdef", 3)).toEqual({ text: "abc", cut: true })
  expect(clip("ab", 3)).toEqual({ text: "ab", cut: false })
  expect(clip("abc", 3)).toEqual({ text: "abc", cut: false })
})

test("an account key drops the colons a cut left dangling, and is never empty", () => {
  expect(accountKeyAfterCut("assets:bank")).toBe("assets:bank")
  expect(accountKeyAfterCut("assets:bank:")).toBe("assets:bank")
  expect(accountKeyAfterCut("assets::")).toBe("assets")
  expect(accountKeyAfterCut(":")).toBe(":")
  expect(accountKeyAfterCut("::")).toBe("::")
})
