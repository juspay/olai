import { expect, test } from "bun:test"

import { text } from "./decimal.ts"
import { postingOf } from "./posting.ts"

/** One posting line as `[account, virtual, quantity]`, or `null` when the line
 *  is refused — a shape a whole journal asserts elsewhere, and this file asks
 *  of one line. */
const row = (raw: string): ReadonlyArray<unknown> | null => {
  const one = postingOf(raw)
  if (one === null) return null
  const amount = one.posting.amount
  return [one.posting.account, one.posting.virtual, amount === null ? null : text(amount.value)]
}

// The account ends at TWO spaces or a tab, which is what lets it hold one.
//
test("an account may hold a single space and ends at two", () => {
  expect([row("expenses:dining out  $20"), row("assets:cash  -$20"), row("\tassets:cash\t-$20")]).toEqual([
    ["expenses:dining out", "no", "20"],
    ["assets:cash", "no", "-20"],
    ["assets:cash", "no", "-20"],
  ])
})

// The three bracket pairs, a posting's own status mark, and the fact that a
// cost annotation and a balance assertion are not part of the amount. (from
// "virtual postings and status marks are typed, and annotations do not leak
// into the amount")
test("virtual postings and status marks are typed, and annotations do not leak into the amount", () => {
  expect([
    row("* (budget:food)  $20"),
    row("! [assets:cash]  -$40"),
    row("assets:stock  5 AAPL @ $100"),
    row("assets:cash  $10 = $10"),
  ]).toEqual([
    ["budget:food", "unbalanced", "20"],
    ["assets:cash", "balanced", "-40"],
    ["assets:stock", "no", "5"],
    ["assets:cash", "no", "10"],
  ])
})

// A line that LOOKS like a posting and states something unreadable is refused,
// and the cost flag is remembered rather than modelled.
test("a posting that states something unreadable is refused", () => {
  expect(row("a  1E3 X")).toBeNull()
  expect(row("a")).toEqual(["a", "no", null])
  expect(postingOf("a  10 EUR @ $1.10")?.cost).toBe(true)
  expect(postingOf("a  10 EUR")?.cost).toBe(false)
})

// A COST AND AN ASSERTION ARE KEPT AS WRITTEN. Neither is modelled — hledger
// converts with the first and checks a running total with the second — and a
// page that draws somebody's journal has to show them.
test("the cost and the assertion are kept as the file wrote them", () => {
  const one = postingOf("    assets:investments:brokerage:VTI   5 VTI @ $271.12")!
  expect(one.posting.amount?.written).toBe("5")
  expect(one.posting.cost).toBe("@ $271.12")
  expect(one.posting.assertion).toBeNull()

  const reconciled = postingOf("    assets:bank:hdfc:checking   $0 = $5,123.45")!
  expect(reconciled.posting.amount?.written).toBe("0")
  expect(reconciled.posting.cost).toBeNull()
  expect(reconciled.posting.assertion).toBe("= $5,123.45")

  // An assertion-only line states no amount of its own.
  const claimed = postingOf("    assets:bank:hdfc:checking   = $5,123.45")!
  expect(claimed.posting.amount).toBeNull()
  expect(claimed.posting.assertion).toBe("= $5,123.45")
})

// THE DIGITS ARE THE FILE'S, grouping and all: a page draws what the file says.
test("an amount keeps the digits the file wrote", () => {
  expect(postingOf("    a  $4,250.00")!.posting.amount?.written).toBe("4,250.00")
  expect(postingOf("    a  1,240.00 INR")!.posting.amount?.written).toBe("1,240.00")
  expect(postingOf("    a  $4250.00")!.posting.amount?.written).toBe("4250.00")
  // …and the value is the arithmetic either way.
  expect(text(postingOf("    a  $4,250.00")!.posting.amount!.value)).toBe("4250.00")
})

// THE PROSE IS THE COMMENT'S OWN WORDS: a page draws the prose once and the
// tags once, rather than the whole comment and then the tags out of it.
test("a posting's comment is kept as prose and as tags, not twice", () => {
  const one = postingOf("    a  $1  ; withheld")!
  expect([one.posting.prose, one.posting.tags]).toEqual(["withheld", []])
  const two = postingOf("    a  $1  ; trip:munich-2026, my share was a third")!
  expect(two.posting.prose).toBe("my share was a third")
  expect(two.posting.tags).toEqual([{ key: "trip", value: "munich-2026" }])
})
