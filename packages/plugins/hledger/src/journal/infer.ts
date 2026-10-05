/**
 * THE ONE AMOUNT A TRANSACTION MAY OMIT — filled in, or honestly left out.
 *
 * hledger's rule is that one posting's amount may be omitted and is inferred to
 * make its group balance. This reads it the same way WHEN it can: the
 * transaction's ordinary postings are one group and its BALANCED virtuals
 * (`[…]`) are another — a `(…)` unbalanced virtual never balances anything and
 * is never inferred into — and within a group, exactly one omission with every
 * stated amount in one commodity.
 *
 * TWO THINGS TURN IT OFF FOR THE WHOLE TRANSACTION, and both are the same kind
 * of reason. A COST (`@`) is a conversion this reader does not do: hledger
 * balances such a transaction in the cost commodity. And a REFUSED posting is a
 * movement the sum does not know about: inferring beside it would be arithmetic
 * over a hole. In either case the omission stays unknown and says so.
 *
 * This is PURE: stated postings in, finished postings out, no bounds and no
 * state. The `style: null` on a filled amount is the mark of a computed one
 * (`../browser/spell.ts` gives it the house spelling).
 */
import { add, negate, zero } from "./decimal.ts"
import { type Posting, type Stated } from "./posting.ts"

/** The stated postings of one transaction, and whether any of them was
 *  refused — answered with every posting, the omitted one filled when it can
 *  be and left `null` when it cannot. */
export const infer = (items: ReadonlyArray<Stated>, refused: boolean): ReadonlyArray<Posting> => {
  const postings = items.map((one) => one.posting)
  const filled = new Map<number, Posting["amount"]>()
  if (!refused && !items.some((one) => one.cost)) {
    for (const virtual of ["no", "balanced"] as const) {
      const group = items.flatMap((one, at) => (one.posting.virtual === virtual ? [{ one, at }] : []))
      const known = group.filter(({ one }) => one.posting.amount !== null)
      const missing = group.filter(({ one }) => one.posting.amount === null)
      const commodities = new Set(known.map(({ one }) => one.posting.amount?.commodity ?? ""))
      if (missing.length !== 1 || known.length === 0 || commodities.size !== 1) continue
      const target = missing[0]
      if (target === undefined) continue
      let sum = zero
      for (const { one } of known) if (one.posting.amount !== null) sum = add(sum, one.posting.amount.value)
      // The COMMODITY comes from an amount the group DID state — the posting
      // being inferred into has none, which is the whole reason it is here.
      const commodity = known[0]?.one.posting.amount?.commodity ?? ""
      filled.set(target.at, { commodity, value: negate(sum), style: null })
    }
  }
  return postings.map((posting, at) => {
    const amount = filled.get(at)
    return amount === undefined ? posting : { ...posting, amount, inferred: true }
  })
}
