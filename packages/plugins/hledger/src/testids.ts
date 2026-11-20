export const TESTID = {
  hledgerLink: "hledger-link",
  hledgerHeader: "hledger-header",
  hledgerFact: "hledger-fact",
  hledgerUnreadable: "hledger-unreadable",
  hledgerTab: "hledger-tab",
  hledgerTransactions: "hledger-transactions",
  hledgerBalances: "hledger-balances",
  hledgerSource: "hledger-source",
  hledgerSaid: "hledger-said",
  hledgerMonth: "hledger-month",
  hledgerTxn: "hledger-txn",
  hledgerDate: "hledger-date",
  hledgerDay: "hledger-day",
  hledgerTxnNote: "hledger-txn-note",
  hledgerTxnComment: "hledger-txn-comment",
  hledgerTag: "hledger-tag",
  hledgerStatus: "hledger-status",
  hledgerPosting: "hledger-posting",
  hledgerPostingComment: "hledger-posting-comment",
  hledgerAccount: "hledger-account",
  hledgerAmount: "hledger-amount",
  hledgerAmountTail: "hledger-amount-tail",
  hledgerCost: "hledger-cost",
  hledgerAssertion: "hledger-assertion",
  hledgerInferred: "hledger-inferred",
  hledgerBalance: "hledger-balance",
  hledgerBalanceAccount: "hledger-balance-account",
  hledgerBalanceAmount: "hledger-balance-amount",
  hledgerBalanceEmpty: "hledger-balance-empty",
  hledgerBalanceToggle: "hledger-balance-toggle",
  hledgerBalanceHead: "hledger-balance-head",
  hledgerBalanceCommodity: "hledger-balance-commodity",
  hledgerDepth: "hledger-depth",
  hledgerSourceLine: "hledger-source-line",
  hledgerSourceNumber: "hledger-source-number",
  hledgerEmpty: "hledger-empty",
} as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/hledger": OwnedTestIds }
}
