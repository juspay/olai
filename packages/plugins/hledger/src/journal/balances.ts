import { add, type Decimal, zero } from "./decimal.ts"

export interface Movement {
  readonly account: string
  readonly commodity: string
  readonly value: Decimal
}

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
