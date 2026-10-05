/** Stable identifiers owned by this row's browser contributions.
 *
 * The table is the FROZEN DOM CONTRACT the plugin's e2e binds to: a value
 * spelled here is what a scenario looks for, and a rename is a type error in
 * the package that renamed it rather than a locator that matches nothing. The
 * row shapes (a transaction, a posting, a tag, the month band, a balance row,
 * a source line) are here for the reason the containers are.
 */
export const TESTID = {
  hledgerLink: "hledger-link",
  hledgerHeader: "hledger-header",
  /** One fact of the header row, `data-fact="dates|transactions|accounts|commodities"`. */
  hledgerFact: "hledger-fact",
  /** The button that lists the lines the reader could not make sense of. */
  hledgerUnreadable: "hledger-unreadable",
  hledgerTab: "hledger-tab",
  hledgerTransactions: "hledger-transactions",
  hledgerBalances: "hledger-balances",
  /** The source view — the file's own bytes. Renamed from `hledger-raw`. */
  hledgerSource: "hledger-source",
  hledgerSaid: "hledger-said",
  /** A month band in the transactions grid, `data-month="2026-07"`. */
  hledgerMonth: "hledger-month",
  hledgerTxn: "hledger-txn",
  hledgerTxnNote: "hledger-txn-note",
  hledgerTxnComment: "hledger-txn-comment",
  hledgerTag: "hledger-tag",
  hledgerStatus: "hledger-status",
  hledgerPosting: "hledger-posting",
  hledgerPostingComment: "hledger-posting-comment",
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
  /** The depth control; each button also carries `data-depth="1|2|3|all"`. */
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
