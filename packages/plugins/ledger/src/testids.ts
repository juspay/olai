/** Stable identifiers owned by this row's browser contributions. */
export const TESTID = {
  ledgerLink: "ledger-link",
  ledgerHeader: "ledger-header",
  ledgerTab: "ledger-tab",
  ledgerTransactions: "ledger-transactions",
  ledgerBalances: "ledger-balances",
  ledgerRaw: "ledger-raw",
  ledgerSaid: "ledger-said",
  /** The rows inside the three views: one transaction, its note and its
   *  comment, one tag, one posting and its comment, one account of the tree
   *  with its per-commodity totals, and one line of the raw source. They are
   *  here rather than spelled at each use for the reason the containers are:
   *  a rename is a type error in the package that renamed it. */
  ledgerTxn: "ledger-txn",
  ledgerTxnNote: "ledger-txn-note",
  ledgerTxnComment: "ledger-txn-comment",
  ledgerTag: "ledger-tag",
  ledgerPosting: "ledger-posting",
  ledgerPostingComment: "ledger-posting-comment",
  ledgerBalance: "ledger-balance",
  ledgerBalanceAccount: "ledger-balance-account",
  ledgerBalanceAmount: "ledger-balance-amount",
  ledgerRawLine: "ledger-raw-line",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/ledger": OwnedTestIds }
}
