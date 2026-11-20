import { expect, test } from "bun:test"

import { text } from "./decimal.ts"
import { type Amount } from "./amount.ts"
import { readJournal } from "./read.ts"

const stated = (amount: Amount): ReadonlyArray<unknown> => [amount.commodity, text(amount.value)]

test("a transaction is its header's facts and its postings", () => {
  const journal = readJournal(
    "2026-01-05 * (INV-1) Grocery Store | weekly shop  ; trip:berlin, paid:true\n" +
      "    expenses:food:groceries        $120.50\n" +
      "    assets:bank:checking\n",
  )
  expect(journal.transactions).toHaveLength(1)
  const one = journal.transactions[0]!
  expect(one.date).toBe("2026-01-05")
  expect(one.secondaryDate).toBeNull()
  expect(one.status).toBe("cleared")
  expect(one.code).toBe("INV-1")
  expect(one.description).toBe("Grocery Store | weekly shop")
  expect(one.payee).toBe("Grocery Store")
  expect(one.note).toBe("weekly shop")
  expect(one.comment).toBe("trip:berlin, paid:true")
  expect(one.tags).toEqual([
    { key: "trip", value: "berlin" },
    { key: "paid", value: "true" },
  ])
  expect(
    one.postings.map((posting) => [
      posting.account,
      posting.amount === null ? null : stated(posting.amount),
      posting.inferred,
    ]),
  ).toEqual([
    ["expenses:food:groceries", ["$", "120.50"], false],
    ["assets:bank:checking", ["$", "-120.50"], true],
  ])
})

test("an impossible day, an impossible secondary date and a glued word are unknowns", () => {
  const impossible = readJournal("2024-02-31 nothing happens\n")
  expect(impossible.transactions).toEqual([])
  expect(impossible.entries).toEqual([{ line: 1, span: 1, text: "2024-02-31 nothing happens", kind: "unknown" }])

  const leap = readJournal("2024-02-29 Leap day\n    a  $1\n    b\n")
  expect(leap.transactions.map((one) => one.date)).toEqual(["2024-02-29"])
  expect(readJournal("2023-02-29 Not a leap year\n").transactions).toEqual([])

  expect(readJournal("2026-01-01=2026-02-30 x\n").transactions).toEqual([])
  expect(readJournal("2026-01-01x y\n").transactions).toEqual([])
  expect(readJournal("2026-01-01=2026-01-02 x\n    a  $1\n    b\n").transactions[0]!.secondaryDate).toBe("2026-01-02")
})

test("a posting that states something unreadable is kept as raw text", () => {
  for (const region of ["10 20", "1E3 X", "1.2.3", "5 AAPL2", "$1 00", "10-20"]) {
    const journal = readJournal(`2026-01-05 x\n    a  ${region}\n    b  $1\n`)
    expect(journal.transactions[0]!.postings.map((posting) => posting.account), region).toEqual(["b"])
    expect(journal.entries.map((entry) => entry.text), region).toEqual([`    a  ${region}`])
    expect(journal.entries[0]!.kind, region).toBe("unknown")
  }
  const quoted = readJournal('2026-01-05 x\n    a  5 "AAPL2"\n')
  expect(quoted.transactions[0]!.postings.map((posting) => (posting.amount === null ? null : stated(posting.amount)))).toEqual([
    ["AAPL2", "5"],
  ])
})

test("a refused posting stops the transaction's inference", () => {
  const journal = readJournal("2026-01-05 x\n    a  $10\n    b  1E3 X\n    c\n")
  expect(journal.transactions[0]!.postings.map((posting) => [posting.account, posting.amount === null ? undefined : text(posting.amount.value), posting.inferred])).toEqual([
    ["a", "10", false],
    ["c", undefined, false],
  ])
  expect(journal.entries.map((entry) => entry.kind)).toEqual(["unknown"])
  expect([...(journal.balances.of.get("a") ?? [])].map(stated)).toEqual([["$", "10"]])
  expect(readJournal("2026-01-05 x\n    a  $10\n    c\n").transactions[0]!.postings[1]!.inferred).toBe(true)
})

test("balances add up per account and per commodity, and roll up", () => {
  const journal = readJournal(
    "2026-01-01 a\n" +
      "    assets:bank:checking   $100\n" +
      "    income:salary\n" +
      "2026-01-02 b\n" +
      "    assets:bank:checking   50 EUR\n" +
      "    assets:cash            $25\n" +
      "    expenses:food          $10\n" +
      "    expenses-old           $3\n" +
      "    income:salary\n",
  )
  expect(journal.balances.accounts).toEqual([
    "assets",
    "assets:bank",
    "assets:bank:checking",
    "assets:cash",
    "expenses",
    "expenses:food",
    "expenses-old",
    "income",
    "income:salary",
  ])
  const amounts = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(stated)
  expect(amounts("assets:bank:checking")).toEqual([["$", "100"], ["EUR", "50"]])
  expect(amounts("assets:bank")).toEqual([["$", "100"], ["EUR", "50"]])
  expect(amounts("assets")).toEqual([["$", "125"], ["EUR", "50"]])
  expect(amounts("expenses")).toEqual([["$", "10"]])
  expect(amounts("expenses-old")).toEqual([["$", "3"]])
  expect(amounts("income")).toEqual([["$", "-100"]])
  expect(amounts("income:salary")).toEqual([["$", "-100"]])
})

test("past the transaction bound the reading stops keeping, and says there was more", () => {
  const many = Array.from({ length: 5 }, (_, at) => `2026-01-0${at + 1} t${at}\n    a  $1\n    b  $2\n`).join("")
  const journal = readJournal(many, { transactions: 2 })
  expect(journal.transactions.map((one) => one.date)).toEqual(["2026-01-01", "2026-01-02"])
  expect(journal.moreTransactions).toBe(true)
  const amounts = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(stated)
  expect(amounts("a")).toEqual([["$", "2"]])
  expect(amounts("b")).toEqual([["$", "4"]])

  const whole = readJournal(many)
  expect(whole.moreTransactions).toBe(false)
  expect([...(whole.balances.of.get("a") ?? [])].map(stated)).toEqual([["$", "5"]])
})

test("past the line bound the reading stops and says there was more file", () => {
  const journal = readJournal("2026-01-05 x\n    a  $1\n    b\n", { lines: 1 })
  expect(journal.lines).toBe(1)
  expect(journal.truncated).toBe(true)
  expect(journal.transactions.map((one) => [one.date, one.postings.length])).toEqual([["2026-01-05", 0]])
  expect(readJournal("2026-01-05 x\n    a  $1\n    b\n").truncated).toBe(false)
})

test("a blank line past the bound is more file, and a trailing one is not", () => {
  const blankThenMore = readJournal("a\nb\nc\n\nd\n", { lines: 3 })
  expect([blankThenMore.lines, blankThenMore.truncated]).toEqual([3, true])

  expect(readJournal("a\nb\nc\n\n", { lines: 3 }).truncated).toBe(true)

  expect(readJournal("a\nb\nc\n", { lines: 3 }).truncated).toBe(false)
  expect(readJournal("a\nb\nc", { lines: 3 }).truncated).toBe(false)
  expect(readJournal("", { lines: 3 }).truncated).toBe(false)
  expect(readJournal("a\nb\nc\nd", { lines: 3 }).truncated).toBe(true)
})

test("an empty file is empty, not an error", () => {
  const journal = readJournal("")
  expect(journal.transactions).toEqual([])
  expect(journal.entries).toEqual([])
  expect(journal.balances.accounts).toEqual([])
  expect(journal.balances.of.size).toBe(0)
  expect([journal.lines, journal.moreTransactions, journal.truncated, journal.longCells]).toEqual([0, false, false, false])
})

test("a file with no trailing newline, and one written on another machine", () => {
  expect(readJournal("2026-01-05 x\n    a  $1\n    b").transactions).toHaveLength(1)
  const crlf = readJournal("2026-01-05 x\r\n    a  $1\r\n    b\r\n")
  expect(crlf.transactions).toHaveLength(1)
  expect(crlf.transactions[0]!.postings[1]!.amount!.value).toEqual({ value: -1n, scale: 0 })
})

test("it never throws over anybody's file", () => {
  const rubbish = [
    "\u0000\u0001\u0002",
    "2026-01-05",
    "2026-01-05 * (unclosed\n    a  $\n",
    "    \t\n\t\t\n",
    '"unterminated',
    "2026-01-05 x\n    a  \"unterminated commodity\n",
    "🙂\n\t🙂\n",
    "2026-01-05 x\n    a  1,2,3.4.5\n    b  €\n",
  ]
  for (const text of rubbish) {
    expect(() => readJournal(text)).not.toThrow()
  }
})
