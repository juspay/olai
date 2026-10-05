import { expect, test } from "bun:test"

import {
  HLEDGER_CELL,
  HLEDGER_LINES,
  HLEDGER_TRANSACTIONS,
  hledgerAmountText,
  hledgerJournal,
  type HledgerAmount,
} from "./hledger.ts"

// THE ORDINARY FILE, and the whole of what a page draws from one: the
// transactions, each with its header's facts and its postings. Asserted as
// values rather than as anything a browser would do with them — what a journal
// SAYS is this package's answer, and what an account tree looks like is the
// client's.

test("a transaction is its header's facts and its postings", () => {
  const journal = hledgerJournal(
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
  expect(one.postings.map((posting) => [posting.account, posting.amount?.quantity, posting.inferred])).toEqual([
    ["expenses:food:groceries", "120.50", false],
    ["assets:bank:checking", "-120.50", true],
  ])
  expect(hledgerAmountText(one.postings[0]!.amount!)).toBe("$120.50")
  expect(hledgerAmountText(one.postings[1]!.amount!)).toBe("-$120.50")
})

// Every spelling of a day hledger writes, the secondary date, the pending mark,
// and a description with no `|` in it at all — where the payee IS the
// description, which is hledger's own answer.
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

// A date in a comment is a comment and not a transaction, which is the whole
// reason lines are classified before they are parsed.
test("a date in a comment is a comment", () => {
  const journal = hledgerJournal("; 2026-01-05 something\n# 2026-01-05 too\n* 2026-01-05 as well\n")
  expect(journal.transactions).toEqual([])
  expect(journal.entries.map((entry) => entry.kind)).toEqual(["comment", "comment", "comment"])
})

// ── what is NOT a header ────────────────────────────────────────────────

// THE CALENDAR, month by month: a 31st is a day in March and not in April, a
// 29th is a day in a leap year and not in another, and December is not a month
// without an end.
test("a day is judged against the month it names", () => {
  for (const day of ["2024-03-31", "2024-12-31", "2024-01-31", "2024-02-29", "2023-02-28"]) {
    expect(hledgerJournal(`${day} x\n    a  $1\n    b\n`).transactions.map((one) => one.date), day).toEqual([day])
  }
  for (const day of ["2024-04-31", "2024-06-31", "2024-09-31", "2024-11-31", "2024-02-30", "2023-02-29", "2024-12-32", "2024-02-31", "2024-00-10", "2024-13-01"]) {
    const journal = hledgerJournal(`${day} x\n    a  $1\n    b\n`)
    expect(journal.transactions, day).toEqual([])
    expect(journal.entries[0]?.kind, day).toBe("unknown")
  }
})

// A date-shaped line whose day does not exist, a secondary date that does not,
// and a date glued to a word are all lines this reader cannot make sense of —
// kept as raw text rather than half-read as a transaction.
test("an impossible day, an impossible secondary date and a glued word are unknowns", () => {
  const impossible = hledgerJournal("2024-02-31 nothing happens\n")
  expect(impossible.transactions).toEqual([])
  expect(impossible.entries).toEqual([{ line: 1, text: "2024-02-31 nothing happens", kind: "unknown" }])

  const leap = hledgerJournal("2024-02-29 Leap day\n    a  $1\n    b\n")
  expect(leap.transactions.map((one) => one.date)).toEqual(["2024-02-29"])
  expect(hledgerJournal("2023-02-29 Not a leap year\n").transactions).toEqual([])

  expect(hledgerJournal("2026-01-01=2026-02-30 x\n").transactions).toEqual([])
  expect(hledgerJournal("2026-01-01x y\n").transactions).toEqual([])
  expect(hledgerJournal("2026-01-01=2026-01-02 x\n    a  $1\n    b\n").transactions[0]!.secondaryDate).toBe("2026-01-02")
})

// ── amounts ─────────────────────────────────────────────────────────────

const amountsOf = (text: string): ReadonlyArray<HledgerAmount> =>
  hledgerJournal(text).transactions[0]!.postings.map((posting) => posting.amount!).filter((one) => one !== null)

// Money is never a float, and the separators are read the way tools write them.
test("amounts are exact, on either side of the number", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n" +
      "    a  -1,000.50 EUR\n" +
      "    b  10 USD\n" +
      '    c  "quoted commodity" 5\n' +
      "    d  €1,50\n" +
      "    e  -5 \"quoted commodity\"\n" +
      "    f  1.000,50 EUR\n" +
      "    g  $1 000.00\n",
  )
  expect(journal.transactions[0]!.postings.map((posting) => hledgerAmountText(posting.amount!))).toEqual([
    "-1000.50 EUR",
    "10 USD",
    "quoted commodity 5",
    "€1.50",
    "-5 quoted commodity",
    "1000.50 EUR",
    "$1000.00",
  ])
  expect(journal.transactions[0]!.postings.map((posting) => posting.amount!.commodity)).toEqual([
    "EUR",
    "USD",
    "quoted commodity",
    "€",
    "quoted commodity",
    "EUR",
    "$",
  ])
})

// WHERE THE SIGN WAS WRITTEN is part of the amount, so the page hands back what
// the file wrote: `-$10` keeps its minus in front of the symbol, `$-10` against
// the digits, and a prefix commodity never swallows the sign into itself.
test("a sign is read as a sign and not as part of the commodity", () => {
  const written = amountsOf("2026-01-05 x\n    a  $-10\n    b  -$10\n    c  EUR-5\n    d  -5 EUR\n")
  expect(written.map((one) => [one.commodity, one.quantity, one.sign])).toEqual([
    ["$", "-10", "number"],
    ["$", "-10", "leading"],
    ["EUR", "-5", "number"],
    ["EUR", "-5", "number"],
  ])
  // The render is the file's own: a sign against the digits after a prefix
  // commodity is `EUR-5`, which is what `EUR-5` means.
  expect(written.map(hledgerAmountText)).toEqual(["$-10", "-$10", "EUR-5", "-5 EUR"])
})

// NOTHING IS MIS-READ SILENTLY. A leftover number, an exponent, a digit in an
// unquoted commodity and a number that is not a grouping are lines the page
// keeps as raw text — never an amount the reader invented.
test("a posting that states something unreadable is kept as raw text", () => {
  for (const stated of ["10 20", "1E3 X", "1.2.3", "5 AAPL2", "$1 00", "10-20"]) {
    const journal = hledgerJournal(`2026-01-05 x\n    a  ${stated}\n    b  $1\n`)
    expect(journal.transactions[0]!.postings.map((posting) => posting.account), stated).toEqual(["b"])
    expect(journal.entries.map((entry) => entry.text), stated).toEqual([`    a  ${stated}`])
    expect(journal.entries[0]!.kind).toBe("unknown")
  }
  // The escape hatch is hledger's own: write the commodity quoted.
  expect(amountsOf('2026-01-05 x\n    a  5 "AAPL2"\n').map(hledgerAmountText)).toEqual(["5 AAPL2"])
})

// A LEADING DECIMAL MARK is how hledger writes a fraction of one, and it is a
// number rather than something to refuse — with or without a commodity and a
// space in front of it.
test("a number may begin with its decimal mark", () => {
  expect(amountsOf("2026-01-05 x\n    a  $.50\n    b  .50\n    c  ,5\n    d  $ .25\n").map(hledgerAmountText))
    .toEqual(["$0.50", "0.50", "0.5", "$ 0.25"])
})

// The account ends at TWO spaces or a tab, which is what lets it hold one.
test("an account may hold a single space and ends at two", () => {
  const journal = hledgerJournal("2026-01-05 x\n    expenses:dining out  $20\n    assets:cash  -$20\n")
  expect(journal.transactions[0]!.postings.map((posting) => posting.account)).toEqual(["expenses:dining out", "assets:cash"])
})

// The three bracket pairs, a posting's own status mark, and the fact that a
// cost annotation and a balance assertion are not part of the amount.
test("virtual postings and status marks are typed, and annotations do not leak into the amount", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n" +
      "    * (budget:food)  $20\n" +
      "    ! [assets:cash]  -$40\n" +
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

// ── comments ────────────────────────────────────────────────────────────

// A tag VALUE runs to the next comma or the end of the comment — hledger's own
// rule, which is not the one a whitespace split would pick.
test("a tag value runs to the next comma", () => {
  const journal = hledgerJournal("2026-01-05 x  ; trip:berlin paid:card, paid:true, note:\n    a  $1\n    b\n")
  expect(journal.transactions[0]!.tags).toEqual([
    { key: "trip", value: "berlin paid:card" },
    { key: "paid", value: "true" },
    { key: "note", value: null },
  ])
})

// AN INDENTED COMMENT BELONGS TO WHAT IT SITS UNDER: the transaction before its
// postings, or the posting above it. It is never a posting to an account named
// after the comment, which would invent accounts and break the inference.
test("an indented comment joins the transaction or the posting above it", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n" +
      "    ; the bank's own words: settled\n" +
      "    expenses:food  $10\n" +
      "    ; paid by card\n" +
      "    assets:cash\n",
  )
  const one = journal.transactions[0]!
  expect(one.comment).toBe("the bank's own words: settled")
  expect(one.tags).toEqual([{ key: "words", value: "settled" }])
  expect(one.postings.map((posting) => posting.account)).toEqual(["expenses:food", "assets:cash"])
  expect(one.postings[0]!.comment).toBe("paid by card")
  expect(one.postings[1]!.comment).toBeNull()
  // …and the inferred amount still infers: two amountless "postings" would have
  // made this impossible.
  expect(one.postings[1]!.inferred).toBe(true)
  expect(hledgerAmountText(one.postings[1]!.amount!)).toBe("-$10")

  const under = hledgerJournal("2026-01-05 x\n    expenses:food  $10\n    ; paid by card, tip:5\n    assets:cash\n")
  expect(under.transactions[0]!.postings[0]!.tags).toEqual([{ key: "tip", value: "5" }])
})

// ── what is kept raw ────────────────────────────────────────────────────

// Directives, comments, comment BLOCKS and lines that are none of those are
// kept as the text they are, at their own line numbers, and nothing is
// interpreted — and an indented line CONTINUES the directive above it rather
// than becoming a line the page calls unknown.
test("what is not a transaction or a posting is kept raw, in line order", () => {
  const journal = hledgerJournal(
    "; a header comment\n" +
      "account assets:bank\n" +
      "  ; a subdirective comment\n" +
      "  note the bank's own note\n" +
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
    [5, "directive"],
    [7, "comment"],
    [8, "comment"],
    [9, "comment"],
    [10, "unknown"],
    [11, "unknown"],
  ])
  // A sub-line keeps its own indentation: the entry is the file's lines, not a
  // trim of them.
  expect(journal.entries[1]!.text).toBe("account assets:bank\n  ; a subdirective comment\n  note the bank's own note")
  expect(journal.entries[2]!.text).toBe("P 2026-01-01 $ 1.5 EUR")
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

// ── inference ───────────────────────────────────────────────────────────

// ONE posting may omit its amount, and it is inferred to balance its group —
// but only when the group states ONE commodity.
test("an omitted amount is inferred only when one commodity is in play", () => {
  const single = hledgerJournal("2026-01-05 x\n    a  $10\n    b  $5\n    c\n")
  expect(single.transactions[0]!.postings.map((posting) => [posting.amount?.quantity, posting.inferred])).toEqual([
    ["10", false],
    ["5", false],
    ["-15", true],
  ])
  // The inferred posting counts in the balances like any other.
  expect([...(single.balances.of.get("c") ?? [])].map(hledgerAmountText)).toEqual(["-$15"])

  // TWO commodities and an omission: there is nothing to infer, so the posting
  // says it does not know rather than guessing a commodity.
  const mixed = hledgerJournal("2026-01-05 x\n    a  $10\n    b  5 EUR\n    c\n")
  expect(mixed.transactions[0]!.postings[2]!.amount).toBeNull()
  expect(mixed.transactions[0]!.postings[2]!.inferred).toBe(false)

  // TWO omissions is the same answer, and so is a group that states nothing.
  const two = hledgerJournal("2026-01-05 x\n    a  $10\n    b\n    c\n")
  expect(two.transactions[0]!.postings.map((posting) => posting.amount)).toEqual([expect.anything(), null, null])
  expect(hledgerJournal("2026-01-05 x\n    a\n    b\n").transactions[0]!.postings.map((posting) => posting.amount))
    .toEqual([null, null])
})

// THE GROUPS: ordinary postings balance among themselves, balanced virtuals
// (`[…]`) balance as their own group, and an unbalanced `(…)` posting balances
// nothing at all — it is never inferred into and never counted in the sum.
test("inference is per group and never touches an unbalanced virtual", () => {
  const journal = hledgerJournal(
    "2026-01-05 x\n    a  $10\n    b\n    [c]  $4\n    [d]\n    (e)\n",
  )
  expect(journal.transactions[0]!.postings.map((posting) => [
    posting.account,
    posting.amount === null ? "" : hledgerAmountText(posting.amount),
    posting.inferred,
  ])).toEqual([
    ["a", "$10", false],
    ["b", "-$10", true],
    ["c", "$4", false],
    ["d", "-$4", true],
    ["e", "", false],
  ])
  // …and the unbalanced posting is the one group that could take a wrong sum
  // with it: with `$10` and an omitted `(e)`, the ordinary group must still
  // infer `b` from `a` alone.
  const withVirtual = hledgerJournal("2026-01-05 x\n    a  $10\n    b\n    (e)\n")
  expect(withVirtual.transactions[0]!.postings.map((posting) => [posting.account, posting.amount?.quantity])).toEqual([
    ["a", "10"],
    ["b", "-10"],
    ["e", undefined],
  ])
})

// A posting this reader REFUSED is a movement the sum does not know about, so
// the transaction it sits in loses its inference rather than balancing over a
// hole — the two good postings keep their amounts and the third stays unknown.
test("a refused posting stops the transaction's inference", () => {
  const journal = hledgerJournal("2026-01-05 x\n    a  $10\n    b  1E3 X\n    c\n")
  expect(journal.transactions[0]!.postings.map((posting) => [posting.account, posting.amount?.quantity, posting.inferred])).toEqual([
    ["a", "10", false],
    ["c", undefined, false],
  ])
  expect(journal.entries.map((entry) => entry.kind)).toEqual(["unknown"])
  // …and the balances hold only what was read.
  expect(journal.balances.total.map(hledgerAmountText)).toEqual(["$10"])
  // A transaction with no refusal infers exactly as before, which is what makes
  // the flag a fact about the transaction rather than a global switch.
  expect(hledgerJournal("2026-01-05 x\n    a  $10\n    c\n").transactions[0]!.postings[1]!.inferred).toBe(true)
})

// A transaction with a COST is never inferred from: hledger balances it in the
// cost commodity and this reader does not convert, so it says it does not know.
test("a cost stops the inference rather than guessing a commodity", () => {
  const journal = hledgerJournal("2026-01-05 x\n    a  10 EUR @ $1.10\n    b\n")
  expect(journal.transactions[0]!.postings.map((posting) => [
    posting.amount === null ? "" : hledgerAmountText(posting.amount),
    posting.inferred,
  ])).toEqual([
    ["10 EUR", false],
    ["", false],
  ])
})

// ── balances ────────────────────────────────────────────────────────────

// THE BALANCES, summed per account per commodity and rolled up to every parent
// — and sorted by `:` SEGMENT, so `expenses-old` is not a sibling of the
// children of `expenses`.
test("balances add up per account and per commodity, and roll up", () => {
  const journal = hledgerJournal(
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
  expect(journal.balances.total.map(hledgerAmountText)).toEqual(["$38", "50 EUR"])
  const text = (account: string) => [...(journal.balances.of.get(account) ?? [])].map(hledgerAmountText)
  // The leaf, and the same money at both of its parents.
  expect(text("assets:bank:checking")).toEqual(["$100", "50 EUR"])
  expect(text("assets:bank")).toEqual(["$100", "50 EUR"])
  expect(text("assets")).toEqual(["$125", "50 EUR"])
  expect(text("expenses")).toEqual(["$10"])
  // The salary was INFERRED in the first transaction (one commodity, one
  // omission) and left unknown in the second (two commodities in play).
  expect(text("income:salary")).toEqual(["-$100"])
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
    "2026-01-05 x\n    a  1,2,3.4.5\n    b  €\n",
  ]
  for (const text of rubbish) {
    expect(() => hledgerJournal(text)).not.toThrow()
  }
})

// ── hledgerAmountText, on its own ────────────────────────────────────────

test("an amount is written the way it was read", () => {
  expect(hledgerAmountText({ commodity: "", quantity: "12", sign: "number", side: "prefix", spaced: false })).toBe("12")
  expect(hledgerAmountText({ commodity: "$", quantity: "12.50", sign: "number", side: "prefix", spaced: false })).toBe("$12.50")
  expect(hledgerAmountText({ commodity: "$", quantity: "-12.50", sign: "leading", side: "prefix", spaced: false })).toBe("-$12.50")
  expect(hledgerAmountText({ commodity: "EUR", quantity: "-1000.50", sign: "number", side: "suffix", spaced: true })).toBe("-1000.50 EUR")
})
