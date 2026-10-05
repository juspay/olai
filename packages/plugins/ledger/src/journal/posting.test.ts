import { expect, test } from "bun:test"

import { text } from "./decimal.ts"
import { postingOf } from "./posting.ts"

/** One posting line as `[account, virtual, quantity]`, or `null` when the line
 *  is refused — the shape `hledger.test.ts` asserted through a whole journal. */
const row = (raw: string): ReadonlyArray<unknown> | null => {
  const one = postingOf(raw)
  if (one === null) return null
  const amount = one.posting.amount
  return [one.posting.account, one.posting.virtual, amount === null ? null : text(amount.value)]
}

// The account ends at TWO spaces or a tab, which is what lets it hold one.
// (from `hledger.test.ts`'s "an account may hold a single space and ends at
// two")
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
// and the cost flag is remembered rather than modelled. (from "a posting that
// states something unreadable is kept as raw text")
test("a posting that states something unreadable is refused", () => {
  expect(row("a  1E3 X")).toBeNull()
  expect(row("a")).toEqual(["a", "no", null])
  expect(postingOf("a  10 EUR @ $1.10")?.cost).toBe(true)
  expect(postingOf("a  10 EUR")?.cost).toBe(false)
})
