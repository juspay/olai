import { type Amount } from "./amount.ts"
import { add, negate, zero } from "./decimal.ts"
import { type Posting, type Stated } from "./posting.ts"

export const infer = (items: ReadonlyArray<Stated>, refused: boolean): ReadonlyArray<Posting> => {
  const postings = items.map((one) => one.posting)
  const filled = new Map<number, Amount>()
  if (!refused && !items.some((one) => one.cost)) {
    for (const virtual of ["no", "balanced"] as const) {
      const group = items.flatMap((one, at) => (one.posting.virtual === virtual ? [{ one, at }] : []))
      const known = group.flatMap(({ one }) => (one.says === "amount" ? [one.amount] : []))
      const missing = group.flatMap(({ one, at }) => (one.says === "omitted" ? [at] : []))
      const first = known[0]
      const target = missing[0]
      if (first === undefined || target === undefined || missing.length !== 1) continue
      if (known.some((amount) => amount.commodity !== first.commodity)) continue
      let sum = zero
      for (const amount of known) sum = add(sum, amount.value)
      filled.set(target, { commodity: first.commodity, value: negate(sum), written: null, style: null })
    }
  }
  return postings.map((posting, at) => {
    const amount = filled.get(at)
    return amount === undefined ? posting : { ...posting, amount, inferred: true }
  })
}
