/** Stable identifiers owned by this row's browser contributions. */
export const TESTID = {
  hledgerLink: "hledger-link",
  hledgerHeader: "hledger-header",
  hledgerTab: "hledger-tab",
  hledgerTransactions: "hledger-transactions",
  hledgerBalances: "hledger-balances",
  hledgerRaw: "hledger-raw",
  hledgerSaid: "hledger-said",
  /** The rows inside the three views: one transaction, its note and its
   *  comment, one tag, one posting and its comment, one account of the tree
   *  with its per-commodity totals, and one line of the raw source. They are
   *  here rather than spelled at each use for the reason the containers are:
   *  a rename is a type error in the package that renamed it. */
  hledgerTxn: "hledger-txn",
  hledgerTxnNote: "hledger-txn-note",
  hledgerTxnComment: "hledger-txn-comment",
  hledgerTag: "hledger-tag",
  hledgerPosting: "hledger-posting",
  hledgerPostingComment: "hledger-posting-comment",
  hledgerBalance: "hledger-balance",
  hledgerBalanceAccount: "hledger-balance-account",
  hledgerBalanceAmount: "hledger-balance-amount",
  hledgerRawLine: "hledger-raw-line",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/hledger": OwnedTestIds }
}
