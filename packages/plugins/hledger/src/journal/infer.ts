import { add, negate, zero } from "./decimal.ts"
import { type Posting, type Stated } from "./posting.ts"

export const infer = (items: ReadonlyArray<Stated>, refused: boolean): ReadonlyArray<Posting> => {
  const postings = items.map((one) => one.posting)
  const filled = new Map<number, Posting["amount"]>()
  if (!refused && !items.some((one) => one.cost)) {
    for (const virtual of ["no", "balanced"] as const) {
      const group = items.flatMap((one, at) => (one.posting.virtual === virtual ? [{ one, at }] : []))
      const known = group.filter(({ one }) => one.posting.amount !== null)
      const missing = group.filter(({ one }) => one.posting.amount === null && one.posting.assertion === null)
      const commodities = new Set(known.map(({ one }) => one.posting.amount?.commodity ?? ""))
      if (missing.length !== 1 || known.length === 0 || commodities.size !== 1) continue
      const target = missing[0]
      if (target === undefined) continue
      let sum = zero
      for (const { one } of known) if (one.posting.amount !== null) sum = add(sum, one.posting.amount.value)
      const commodity = known[0]?.one.posting.amount?.commodity ?? ""
      filled.set(target.at, { commodity, value: negate(sum), written: null, style: null })
    }
  }
  return postings.map((posting, at) => {
    const amount = filled.get(at)
    return amount === undefined ? posting : { ...posting, amount, inferred: true }
  })
}
