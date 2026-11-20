import { readJournal, type Journal } from "../journal/index.ts"
import { expect, test } from "bun:test"

import { hledgerSaid } from "./said.ts"

const SAMPLE = `2026-01-05 groceries
    expenses:food    $10
    assets:cash
`
const journal = (over: Partial<Journal> = {}): Journal => ({
  ...readJournal(SAMPLE),
  ...over,
})

test("a page showing the whole file says nothing about what it left out", () => {
  expect(hledgerSaid(journal())).toBeNull()
})

test("a file with nothing in it is not said here — the empty state owns it", () => {
  expect(hledgerSaid(readJournal(""))).toBeNull()
})

test("a file with only directives is not called empty", () => {
  expect(hledgerSaid(readJournal("account expenses:food\n"))).toBeNull()
})

test("a page that ran out of transaction room says which part it drew", () => {
  expect(hledgerSaid(journal({ moreTransactions: true }))).toEqual({
    tone: "aside",
    text: "Showing the first 1,000 transactions.",
  })
})

test("a page whose reading was cut says so", () => {
  expect(hledgerSaid(journal({ truncated: true }))).toEqual({
    tone: "aside",
    text: "The file is longer than 20,000 lines; only the beginning was read.",
  })
})

test("a page that hit both bounds says both, in one sentence", () => {
  expect(hledgerSaid(journal({ moreTransactions: true, truncated: true }))).toEqual({
    tone: "aside",
    text: "Showing the first 1,000 transactions. The file is longer than 20,000 lines; only the beginning was read.",
  })
})

test("a page whose long lines were cut says that too", () => {
  expect(hledgerSaid(journal({ longCells: true }))).toEqual({
    tone: "aside",
    text: "Long lines are cut at 2,000 characters.",
  })
  expect(hledgerSaid(journal({ moreTransactions: true, longCells: true }))?.text)
    .toBe("Showing the first 1,000 transactions. Long lines are cut at 2,000 characters.")
})

test("what it says is an aside, in every mood it has", () => {
  expect(hledgerSaid(journal({ moreTransactions: true }))?.tone).toBe("aside")
  expect(hledgerSaid(journal({ truncated: true }))?.tone).toBe("aside")
})
