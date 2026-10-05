/**
 * WHAT THE POSTINGS COME TO — summed per account per commodity, and rolled up
 * to every parent prefix.
 *
 * Every account's total includes its children's: a posting to
 * `assets:bank:checking` is also a posting to `assets:bank` and `assets`, which
 * is what a person reading an account tree expects to see. Accounts sort by `:`
 * SEGMENT, so `expenses:food` is a child of `expenses` and not a neighbour of
 * `expenses-old`.
 *
 * There is NO SPELLING here: the sums are decimals keyed by commodity, and how
 * a total is WRITTEN is the display's (`../browser/spell.ts`). The reading's
 * job is the arithmetic; the page's is the sentence.
 */
import { add, type Decimal, zero } from "./decimal.ts"

/** One posting's contribution to the account tree. */
export interface Movement {
  readonly account: string
  readonly commodity: string
  readonly value: Decimal
}

/** The postings summed: every named account and every parent prefix, each with
 *  its per-commodity total. */
export const rollup = (movements: ReadonlyArray<Movement>): ReadonlyMap<string, ReadonlyMap<string, Decimal>> => {
  const leaves = new Map<string, Map<string, Decimal>>()
  for (const movement of movements) {
    const held = leaves.get(movement.account) ?? new Map<string, Decimal>()
    held.set(movement.commodity, add(held.get(movement.commodity) ?? zero, movement.value))
    leaves.set(movement.account, held)
  }

  const rolled = new Map<string, Map<string, Decimal>>()
  const addTo = (account: string, commodity: string, value: Decimal): void => {
    const held = rolled.get(account) ?? new Map<string, Decimal>()
    held.set(commodity, add(held.get(commodity) ?? zero, value))
    rolled.set(account, held)
  }
  for (const [account, held] of leaves) {
    const parts = account.split(":")
    for (let depth = 1; depth <= parts.length; depth++) {
      const prefix = parts.slice(0, depth).join(":")
      for (const [commodity, value] of held) addTo(prefix, commodity, value)
    }
  }
  return rolled
}

/**
 * Accounts in TREE order: `:`-separated segments compared one at a time, so
 * `expenses`, `expenses:dining out`, `expenses:food` are contiguous and
 * `expenses-old` follows them — where a plain string sort would put
 * `expenses-old` between the parent and its own children and the flat tree
 * would draw `food` under it.
 */
export const compareAccounts = (left: string, right: string): number => {
  const one = left.split(":")
  const two = right.split(":")
  for (let at = 0; at < Math.min(one.length, two.length); at++) {
    const a = one[at] as string
    const b = two[at] as string
    if (a !== b) return a < b ? -1 : 1
  }
  return one.length - two.length
}
