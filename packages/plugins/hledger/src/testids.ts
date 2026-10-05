/** Stable identifiers owned by this row's browser contributions. */
export const TESTID = {
  hledgerLink: "hledger-link",
  hledgerHeader: "hledger-header",
  hledgerTab: "hledger-tab",
  hledgerTransactions: "hledger-transactions",
  hledgerBalances: "hledger-balances",
  hledgerRaw: "hledger-raw",
  hledgerSaid: "hledger-said",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/hledger": OwnedTestIds }
}
