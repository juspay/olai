import { expect, test } from "bun:test"

import { text } from "./decimal.ts"
import { infer } from "./infer.ts"
import { type Posting, type Stated, postingOf } from "./posting.ts"

/** One posting line as the reading stated it — `null` would be a refusal, and
 *  every line here is one the reader read. */
const stated = (line: string): Stated => {
  const one = postingOf(line)
  if (one === null) throw new Error(`refused: ${line}`)
  return one
}

/** The transaction those posting lines state, inferred. */
const transaction = (lines: ReadonlyArray<string>, refused = false): ReadonlyArray<Posting> =>
  infer(lines.map(stated), refused)

/** `[account, quantity, inferred]` per posting — the shape the old suite read. */
const rows = (postings: ReadonlyArray<Posting>): ReadonlyArray<ReadonlyArray<unknown>> =>
  postings.map((one) => [one.account, one.amount === null ? "" : text(one.amount.value), one.inferred])

// ONE posting may omit its amount, and it is inferred to balance its group —
// but only when the group states ONE commodity.
test("an omitted amount is inferred only when one commodity is in play", () => {
  const single = transaction(["a  $10", "b  $5", "c"])
  expect(rows(single)).toEqual([
    ["a", "10", false],
    ["b", "5", false],
    ["c", "-15", true],
  ])
  // The filled amount is COMPUTED, which the null style says (`../browser/
  // spell.ts` gives it the house spelling).
  expect(single[2]!.amount?.style).toBeNull()
  expect(single[2]!.amount?.commodity).toBe("$")

  // TWO commodities and an omission: there is nothing to infer, so the posting
  // says it does not know rather than guessing a commodity.
  expect(transaction(["a  $10", "b  5 EUR", "c"]).map((one) => one.amount)).toEqual([expect.anything(), expect.anything(), null])
  expect(transaction(["a  $10", "b  5 EUR", "c"])[2]!.inferred).toBe(false)

  // TWO omissions is the same answer, and so is a group that states nothing.
  expect(transaction(["a  $10", "b", "c"]).map((one) => one.amount)).toEqual([expect.anything(), null, null])
  expect(transaction(["a", "b"]).map((one) => one.amount)).toEqual([null, null])
})

// THE GROUPS: ordinary postings balance among themselves, balanced virtuals
// (`[…]`) balance as their own group, and an unbalanced `(…)` posting balances
// nothing at all.
test("inference is per group and never touches an unbalanced virtual", () => {
  const one = transaction(["a  $10", "b", "[c]  $4", "[d]", "(e)"])
  expect(rows(one)).toEqual([
    ["a", "10", false],
    ["b", "-10", true],
    ["c", "4", false],
    ["d", "-4", true],
    ["e", "", false],
  ])
  // …and the unbalanced posting is the one group that could take a wrong sum
  // with it: with `$10` and an omitted `(e)`, the ordinary group must still
  // infer `b` from `a` alone.
  expect(transaction(["a  $10", "b", "(e)"]).map((one) => [one.account, one.amount === null ? undefined : text(one.amount.value)])).toEqual([
    ["a", "10"],
    ["b", "-10"],
    ["e", undefined],
  ])
})

// A transaction with a COST is never inferred from: hledger balances it in the
// cost commodity and this reader does not convert, so it says it does not know.
//
test("a cost stops the inference rather than guessing a commodity", () => {
  const one = transaction(["a  10 EUR @ $1.10", "b"])
  expect(one.map((posting) => [posting.amount === null ? "" : text(posting.amount.value), posting.inferred])).toEqual([
    ["10", false],
    ["", false],
  ])
})

// A REFUSED posting is a movement the sum does not know about, so the whole
// transaction loses its inference rather than balancing over a hole. (from "a
// refused posting stops the transaction's inference", at the inference's own
// level)
test("a refused posting stops the transaction's inference", () => {
  expect(rows(transaction(["a  $10", "c"], true))).toEqual([
    ["a", "10", false],
    ["c", "", false],
  ])
})
