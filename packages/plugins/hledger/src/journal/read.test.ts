import { expect, test } from "bun:test"

import { amountText } from "../browser/spell.ts"
import { text } from "./decimal.ts"
import { readJournal } from "./read.ts"

// THE ORDINARY FILE, and the whole of what a page draws from one: the
// transactions, each with its header's facts and its postings. (from
// `hledger.test.ts`'s "a transaction is its header's facts and its postings")
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
      posting.amount === null ? "" : amountText(posting.amount),
      posting.inferred,
    ]),
  ).toEqual([
    ["expenses:food:groceries", "$120.50", false],
    ["assets:bank:checking", "-$120.50", true],
  ])
})

// A date-shaped line whose day does not exist, a secondary date that does not,
// and a date glued to a word are all lines this reader cannot make sense of —
// kept as raw text rather than half-read as a transaction. (from "an impossible
// day, an impossible secondary date and a glued word are unknowns")
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

// NOTHING IS MIS-READ SILENTLY. A leftover number, an exponent, a digit in an
// unquoted commodity and a number that is not a grouping are lines the page
// keeps as raw text — never an amount the reader invented. (from "a posting
// that states something unreadable is kept as raw text")
test("a posting that states something unreadable is kept as raw text", () => {
  for (const stated of ["10 20", "1E3 X", "1.2.3", "5 AAPL2", "$1 00", "10-20"]) {
    const journal = readJournal(`2026-01-05 x\n    a  ${stated}\n    b  $1\n`)
    expect(journal.transactions[0]!.postings.map((posting) => posting.account), stated).toEqual(["b"])
    expect(journal.entries.map((entry) => entry.text), stated).toEqual([`    a  ${stated}`])
    expect(journal.entries[0]!.kind, stated).toBe("unknown")
  }
  // The escape hatch is hledger's own: write the commodity quoted.
  const quoted = readJournal('2026-01-05 x\n    a  5 "AAPL2"\n')
  expect(quoted.transactions[0]!.postings.map((posting) => (posting.amount === null ? "" : amountText(posting.amount)))).toEqual([
    "5 AAPL2",
  ])
})

// A posting this reader REFUSED is a movement the sum does not know about, so
// the transaction it sits in loses its inference rather than balancing over a
// hole — the two good postings keep their amounts and the third stays unknown.
// (from "a refused posting stops the transaction's inference")
test("a refused posting stops the transaction's inference", () => {
  const journal = readJournal("2026-01-05 x\n    a  $10\n    b  1E3 X\n    c\n")
  expect(journal.transactions[0]!.postings.map((posting) => [posting.account, posting.amount === null ? undefined : text(posting.amount.value), posting.inferred])).toEqual([
    ["a", "10", false],
    ["c", undefined, false],
  ])
  expect(journal.entries.map((entry) => entry.kind)).toEqual(["unknown"])
  // …and the balances hold only what was read.
  expect([...(journal.balances.of.get("a") ?? [])].map(amountText)).toEqual(["$10"])
  // A transaction with no refusal infers exactly as before, which is what makes
  // the flag a fact about the transaction rather than a global switch.
  expect(readJournal("2026-01-05 x\n    a  $10\n    c\n").transactions[0]!.postings[1]!.inferred).toBe(true)
})

// THE BALANCES, summed per account per commodity and rolled up to every parent
// — and sorted by `:` SEGMENT, so `expenses-old` is not a sibling of the
// children of `expenses`. (from "balances add up per account and per commodity,
// and roll up")
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
  const amounts = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(amountText)
  // The leaf, and the same money at both of its parents.
  expect(amounts("assets:bank:checking")).toEqual(["$100", "50 EUR"])
  expect(amounts("assets:bank")).toEqual(["$100", "50 EUR"])
  expect(amounts("assets")).toEqual(["$125", "50 EUR"])
  expect(amounts("expenses")).toEqual(["$10"])
  expect(amounts("expenses-old")).toEqual(["$3"])
  expect(amounts("income")).toEqual(["-$100"])
  // The salary was INFERRED in the first transaction (one commodity, one
  // omission) and left unknown in the second (two commodities in play).
  expect(amounts("income:salary")).toEqual(["-$100"])
})

// THE TRANSACTION BOUND, and the honest half of it: a page that stopped says so.
// (from "past the transaction bound the reading stops keeping, and says there
// was more")
test("past the transaction bound the reading stops keeping, and says there was more", () => {
  const many = Array.from({ length: 5 }, (_, at) => `2026-01-0${at + 1} t${at}\n    a  $1\n    b  $2\n`).join("")
  const journal = readJournal(many, { transactions: 2 })
  expect(journal.transactions.map((one) => one.date)).toEqual(["2026-01-01", "2026-01-02"])
  expect(journal.moreTransactions).toBe(true)
  // The bound did not cost a full read of the postings it dropped: the balances
  // hold the KEPT transactions only — two transactions of $3, not five.
  const amounts = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(amountText)
  expect(amounts("a")).toEqual(["$2"])
  expect(amounts("b")).toEqual(["$4"])

  const whole = readJournal(many)
  expect(whole.moreTransactions).toBe(false)
  expect([...(whole.balances.of.get("a") ?? [])].map(amountText)).toEqual(["$5"])
})

// THE LINE BOUND. (from "past the line bound the reading stops and says there
// was more file")
test("past the line bound the reading stops and says there was more file", () => {
  const journal = readJournal("2026-01-05 x\n    a  $1\n    b\n", { lines: 1 })
  expect(journal.lines).toBe(1)
  expect(journal.truncated).toBe(true)
  // The header was read; its postings were past the bound, so the transaction
  // is a header with nothing under it rather than a guess.
  expect(journal.transactions.map((one) => [one.date, one.postings.length])).toEqual([["2026-01-05", 0]])
  expect(readJournal("2026-01-05 x\n    a  $1\n    b\n").truncated).toBe(false)
})

// A file with nothing in it is `[]` everywhere and says so with its numbers
// rather than with a thrown error. (from "an empty file is empty, not an
// error")
test("an empty file is empty, not an error", () => {
  const journal = readJournal("")
  expect(journal.transactions).toEqual([])
  expect(journal.entries).toEqual([])
  expect(journal.balances.accounts).toEqual([])
  expect(journal.balances.of.size).toBe(0)
  expect([journal.lines, journal.moreTransactions, journal.truncated, journal.longCells]).toEqual([0, false, false, false])
})

// No trailing newline is still a whole last line; `\r\n` is one ending. (from
// "a file with no trailing newline, and one written on another machine")
test("a file with no trailing newline, and one written on another machine", () => {
  expect(readJournal("2026-01-05 x\n    a  $1\n    b").transactions).toHaveLength(1)
  const crlf = readJournal("2026-01-05 x\r\n    a  $1\r\n    b\r\n")
  expect(crlf.transactions).toHaveLength(1)
  expect(crlf.transactions[0]!.postings[1]!.amount!.value).toEqual({ value: -1n, scale: 0 })
})

// NEVER THROWS, whatever it is handed — a file being written while it is read,
// somebody else's text, an unbalanced quote. (from "it never throws over
// anybody's file")
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
