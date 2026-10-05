import { expect, test } from "bun:test"

import {
  HLEDGER_CELL,
  HLEDGER_LINES,
  HLEDGER_TRANSACTIONS,
  hledgerAmountText,
  hledgerJournal,
} from "./hledger.ts"

// THE ORDINARY FILE, and the whole of what a page draws from one: the
// transactions, each with its header's facts and its postings. Asserted as
// values rather than as anything a browser would do with them — what a journal
// SAYS is this package's answer, and what an account tree looks like is the
// client's.

test("a transaction is its header's facts and its postings", () => {
  const journal = hledgerJournal(
    "2026-01-05 * (INV-1) Grocery Store | weekly shop  ; trip:market, paid:true\n" +
      "    expenses:food:groceries        $120.50\n" +
      "    assets:bank:checking\n",
  )
  expect(journal.transactions).toHaveLength(1)
  const one = journal.transactions[0]!
  expect(one.date).toBe("2026-01-05")
  expect(one.dateWritten).toBe("2026-01-05")
  expect(one.secondaryDate).toBeNull()
  expect(one.status).toBe("cleared")
  expect(one.code).toBe("INV-1")
  expect(one.description).toBe("Grocery Store | weekly shop")
  expect(one.payee).toBe("Grocery Store")
  expect(one.note).toBe("weekly shop")
  expect(one.comment).toBe("trip:market, paid:true")
  expect(one.tags).toEqual([
    { key: "trip", value: "market" },
    { key: "paid", value: "true" },
  ])
  expect(one.line).toBe(1)
  expect(one.postings.map((posting) => [posting.account, posting.amount?.quantity, posting.inferred])).toEqual([
    ["expenses:food:groceries", "120.50", false],
    ["assets:bank:checking", "-120.50", true],
  ])
  // The commodity was on the left and stayed there.
  expect(hledgerAmountText(one.postings[0]!.amount!)).toBe("$120.50")
  expect(hledgerAmountText(one.postings[1]!.amount!)).toBe("$-120.50")
})

// Every spelling of a day hledger writes, the secondary date, the pending mark,
// and a description with no `|` in it at all.
test("a header is read through every spelling it has", () => {
  const journal = hledgerJournal(
    "2026/1/5=2026-01-06 ! Lunch\n    expenses:food  $10\n    assets:cash\n" +
      "2026.2.28 Dinner\n    expenses:food  $10\n    assets:cash\n",
  )
  expect(journal.transactions.map((one) => [one.date, one.secondaryDate, one.status, one.payee, one.note])).toEqual([
    ["2026-01-05", "2026-01-06", "pending", "Lunch", null],
    ["2026-02-28", null, "unmarked", "Dinner", null],
  ])
})

// A commented-out header is a comment and not a transaction, which is the whole
// reason lines are classified before they are parsed.
test("a date in a comment is a comment", () => {
  const journal = hledgerJournal("; 2026-01-05 something\n# 2026-01-05 too\n* 2026-01-05 as well\n")
  expect(journal.transactions).toEqual([])
  expect(journal.entries.map((entry) => entry.kind)).toEqual(["comment", "comment", "comment"])
})

// Money is never a float, and the separators are read the way tools write them.
test("amounts are exact, on either side of the number", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n" +
      "    a  -1,000.50 EUR\n" +
      "    b  10 USD\n" +
      '    c  "quoted commodity" 5\n' +
      "    d  €1,50\n" +
      "    e  -5 \"quoted commodity\"\n",
  )
  const amounts = journal.transactions[0]!.postings.map((posting) => hledgerAmountText(posting.amount!))
  expect(amounts).toEqual(["-1000.50 EUR", "10 USD", "quoted commodity 5", "€1.50", "-5 quoted commodity"])
  expect(journal.transactions[0]!.postings.map((posting) => posting.amount!.commodity)).toEqual([
    "EUR",
    "USD",
    "quoted commodity",
    "€",
    "quoted commodity",
  ])
})

// The account ends at TWO spaces or a tab, which is what lets it hold one.
test("an account may hold a single space and ends at two", () => {
  const journal = hledgerJournal("2026-01-05 x\n    expenses:dining out  $20\n    assets:cash  -$20\n")
  expect(journal.transactions[0]!.postings.map((posting) => posting.account)).toEqual(["expenses:dining out", "assets:cash"])
})

// The three bracket pairs, and the fact that a cost annotation and a balance
// assertion are not part of the amount.
test("virtual postings are typed and annotations do not leak into the amount", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n" +
      "    (budget:food)  $20\n" +
      "    [assets:cash]  -$40\n" +
      "    assets:stock  5 AAPL @ $100\n" +
      "    assets:cash  $10 = $10\n",
  )
  const postings = journal.transactions[0]!.postings
  expect(postings.map((posting) => [posting.account, posting.virtual, posting.amount?.quantity])).toEqual([
    ["budget:food", "unbalanced", "20"],
    ["assets:cash", "balanced", "-40"],
    ["assets:stock", "no", "5"],
    ["assets:cash", "no", "10"],
  ])
})

// ONE posting may omit its amount, and it is inferred to balance the
// transaction — but only when the transaction states ONE commodity.
test("an omitted amount is inferred only when one commodity is in play", () => {
  const single = hledgerJournal("2026-01-05 x\n    a  $10\n    b  $5\n    c\n")
  expect(single.transactions[0]!.postings.map((posting) => [posting.amount?.quantity, posting.inferred])).toEqual([
    ["10", false],
    ["5", false],
    ["-15", true],
  ])
  expect(single.balances.inferred).toBe(1)
  // The inferred posting counts in the balances like any other.
  expect([...(single.balances.of.get("c") ?? [])].map(hledgerAmountText)).toEqual(["$-15"])

  // TWO commodities and an omission: there is nothing to infer, so the posting
  // says it does not know rather than guessing a commodity.
  const mixed = hledgerJournal("2026-01-05 x\n    a  $10\n    b  5 EUR\n    c\n")
  expect(mixed.transactions[0]!.postings[2]!.amount).toBeNull()
  expect(mixed.transactions[0]!.postings[2]!.inferred).toBe(false)
  expect(mixed.balances.inferred).toBe(0)

  // TWO omissions is the same answer.
  const two = hledgerJournal("2026-01-05 x\n    a  $10\n    b\n    c\n")
  expect(two.transactions[0]!.postings.map((posting) => posting.amount)).toEqual([expect.anything(), null, null])
})

// Directives, comments, comment BLOCKS and lines that are none of those are
// kept as the text they are, at their own line numbers, and nothing is
// interpreted.
test("what is not a transaction or a posting is kept raw, in line order", () => {
  const journal = hledgerJournal(
    "; a header comment\n" +
      "account assets:bank\n" +
      "P 2026-01-01 $ 1.5 EUR\n" +
      "\n" +
      "comment\n" +
      "this is prose\n" +
      "end comment\n" +
      "2026-13-99 not a real day\n" +
      "  stray:thing\n",
  )
  expect(journal.entries.map((entry) => [entry.line, entry.kind])).toEqual([
    [1, "comment"],
    [2, "directive"],
    [3, "directive"],
    [5, "comment"],
    [6, "comment"],
    [7, "comment"],
    [8, "unknown"],
    [9, "unknown"],
  ])
  expect(journal.entries[1]!.text).toBe("account assets:bank")
  expect(journal.transactions).toEqual([])
})

// A directive BETWEEN two transactions ends the first and does not become a
// posting of either.
test("a directive between two transactions belongs to neither", () => {
  const journal = hledgerJournal(
    "2026-01-01 x\n    a  $1\n    b\n" + "\n" + "account foo\n" + "\n" + "2026-01-02 y\n    a  $2\n    b\n",
  )
  expect(journal.transactions.map((one) => one.date)).toEqual(["2026-01-01", "2026-01-02"])
  expect(journal.entries.map((entry) => [entry.line, entry.text])).toEqual([[5, "account foo"]])
})

// THE BALANCES, summed per account per commodity and rolled up to every parent.
test("balances add up per account and per commodity, and roll up", () => {
  const journal = hledgerJournal(
    "2026-01-01 a\n" +
      "    assets:bank:checking   $100\n" +
      "    income:salary\n" +
      "2026-01-02 b\n" +
      "    assets:bank:checking   50 EUR\n" +
      "    assets:cash            $25\n" +
      "    expenses:food          $10\n" +
      "    income:salary\n",
  )
  expect(journal.balances.accounts).toEqual([
    "assets",
    "assets:bank",
    "assets:bank:checking",
    "assets:cash",
    "expenses",
    "expenses:food",
    "income",
    "income:salary",
  ])
  expect(journal.balances.leaves).toEqual(["assets:bank:checking", "assets:cash", "expenses:food", "income:salary"])
  expect(journal.balances.total.map(hledgerAmountText)).toEqual(["$35", "50 EUR"])
  const text = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(hledgerAmountText)
  // The leaf, and the same money at both of its parents.
  expect(text("assets:bank:checking")).toEqual(["$100", "50 EUR"])
  expect(text("assets:bank")).toEqual(["$100", "50 EUR"])
  expect(text("assets")).toEqual(["$125", "50 EUR"])
  expect(text("expenses")).toEqual(["$10"])
  // The salary was INFERRED in the first transaction (one commodity, one
  // omission) and left unknown in the second (two commodities in play), so it
  // is a named account with a real balance and not a guess about the second.
  expect(text("income:salary")).toEqual(["$-100"])
  expect(journal.balances.inferred).toBe(1)
})

// A file with nothing in it is `[]` everywhere and says so with its numbers
// rather than with a thrown error.
test("an empty file is empty, not an error", () => {
  const journal = hledgerJournal("")
  expect(journal.transactions).toEqual([])
  expect(journal.entries).toEqual([])
  expect(journal.balances.accounts).toEqual([])
  expect(journal.balances.total).toEqual([])
  expect([journal.lines, journal.moreTransactions, journal.truncated, journal.longCells]).toEqual([0, false, false, false])
})

// No trailing newline is still a whole last line; `\r\n` is one ending.
test("a file with no trailing newline, and one written on another machine", () => {
  expect(hledgerJournal("2026-01-05 x\n    a  $1\n    b").transactions).toHaveLength(1)
  const crlf = hledgerJournal("2026-01-05 x\r\n    a  $1\r\n    b\r\n")
  expect(crlf.transactions).toHaveLength(1)
  expect(crlf.transactions[0]!.postings[1]!.amount!.quantity).toBe("-1")
})

// ── the bounds ──────────────────────────────────────────────────────────

// THE TRANSACTION BOUND, and the honest half of it: a page that stopped says so.
test("past the transaction bound the reading stops keeping, and says there was more", () => {
  const many = Array.from({ length: 5 }, (_, at) => `2026-01-0${at + 1} t${at}\n    a  $1\n    b  $2\n`).join("")
  const journal = hledgerJournal(many, { transactions: 2 })
  expect(journal.transactions.map((one) => one.date)).toEqual(["2026-01-01", "2026-01-02"])
  expect(journal.moreTransactions).toBe(true)
  // The bound did not cost a full read of the postings it dropped: the
  // balances hold the KEPT transactions only — two transactions of $3, not
  // five.
  expect(journal.balances.total.map(hledgerAmountText)).toEqual(["$6"])

  const whole = hledgerJournal(many)
  expect(whole.moreTransactions).toBe(false)
  expect(whole.balances.total.map(hledgerAmountText)).toEqual(["$15"])
})

// THE LINE BOUND.
test("past the line bound the reading stops and says there was more file", () => {
  const journal = hledgerJournal("2026-01-05 x\n    a  $1\n    b\n", { lines: 1 })
  expect(journal.lines).toBe(1)
  expect(journal.truncated).toBe(true)
  // The header was read; its postings were past the bound, so the transaction
  // is a header with nothing under it rather than a guess.
  expect(journal.transactions.map((one) => [one.date, one.postings.length])).toEqual([["2026-01-05", 0]])
  expect(hledgerJournal("2026-01-05 x\n    a  $1\n    b\n").truncated).toBe(false)
})

// THE CELL BOUND, on any one field.
test("a field longer than the bound is cut, and the cut is said", () => {
  const journal = hledgerJournal(`2026-01-05 ${"x".repeat(40)}\n    a  $1\n    b\n`, { cell: 10 })
  expect(journal.transactions[0]!.description).toBe("x".repeat(10))
  expect(journal.longCells).toBe(true)
})

// The bounds are the ones this module declares, and they are numbers a page can
// say in a sentence.
test("the defaults are the named bounds", () => {
  expect([HLEDGER_LINES, HLEDGER_TRANSACTIONS, HLEDGER_CELL]).toEqual([20_000, 1_000, 2_000])
  expect(hledgerJournal("").lines).toBe(0)
})

// NEVER THROWS, whatever it is handed — a file being written while it is read,
// somebody else's text, an unbalanced quote.
test("it never throws over anybody's file", () => {
  const rubbish = [
    "\u0000\u0001\u0002",
    "2026-01-05",
    "2026-01-05 * (unclosed\n    a  $\n",
    "    \t\n\t\t\n",
    '"unterminated',
    "2026-01-05 x\n    a  \"unterminated commodity\n",
    "🙂\n\t🙂\n",
  ]
  for (const text of rubbish) {
    expect(() => hledgerJournal(text)).not.toThrow()
  }
})

// ── hledgerAmountText, on its own ────────────────────────────────────────

test("an amount is written the way it was read", () => {
  expect(hledgerAmountText({ commodity: "", quantity: "12", side: "prefix", spaced: false })).toBe("12")
  expect(hledgerAmountText({ commodity: "$", quantity: "12.50", side: "prefix", spaced: false })).toBe("$12.50")
  expect(hledgerAmountText({ commodity: "EUR", quantity: "-1000.50", side: "suffix", spaced: true })).toBe("-1000.50 EUR")
})
