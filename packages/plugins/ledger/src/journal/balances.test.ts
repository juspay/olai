import { expect, test } from "bun:test"

import { type Movement, compareAccounts, rollup } from "./balances.ts"
import { type Decimal, text } from "./decimal.ts"

/** One movement, written the way the reading states it. */
const moved = (account: string, commodity: string, value: bigint): Movement => ({ account, commodity, value: { value, scale: 0 } })

/** One account's totals as `quantity commodity` strings, sorted by commodity
 *  the way `./read.ts` hands them out. */
const held = (accounts: ReadonlyMap<string, ReadonlyMap<string, Decimal>>, account: string): ReadonlyArray<string> =>
  [...(accounts.get(account) ?? [])]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([commodity, value]) => `${text(value)} ${commodity}`)

// The sum per account per commodity, rolled up to every parent prefix. (from
// `hledger.test.ts`'s "balances add up per account and per commodity, and roll
// up", at the rollup's own level)
test("movements roll up to every parent prefix", () => {
  const rolled = rollup([
    moved("assets:bank:checking", "$", 100n),
    moved("assets:bank:checking", "EUR", 50n),
    moved("assets:cash", "$", 25n),
    moved("expenses:food", "$", 10n),
    moved("expenses-old", "$", 3n),
  ])
  expect(held(rolled, "assets:bank:checking")).toEqual(["100 $", "50 EUR"])
  expect(held(rolled, "assets:bank")).toEqual(["100 $", "50 EUR"])
  expect(held(rolled, "assets")).toEqual(["125 $", "50 EUR"])
  expect(held(rolled, "expenses")).toEqual(["10 $"])
  expect(held(rolled, "expenses-old")).toEqual(["3 $"])
  // The parent prefix is the account AS WRITTEN plus every prefix, and nothing
  // else.
  expect([...rolled.keys()].sort()).toEqual(
    ["assets", "assets:bank", "assets:bank:checking", "assets:cash", "expenses", "expenses-old", "expenses:food"].sort(),
  )
})

// THE ORDER OF THE TREE, by `:` SEGMENT — so `expenses-old` is not a sibling of
// the children of `expenses`.
test("accounts sort by segment, not by string", () => {
  expect(
    ["expenses", "expenses:food", "expenses:dining out", "expenses-old", "expenses:food:groceries"].sort(compareAccounts),
  ).toEqual(["expenses", "expenses:dining out", "expenses:food", "expenses:food:groceries", "expenses-old"])
})
