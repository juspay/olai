/**
 * THIS ROW'S SELECTORS — a ledger page's own ids, spelled once, for its own
 * steps.
 *
 * Every id comes from `../src/testids.ts`, which is this package's own file: a
 * rename there is a type error here rather than a scenario that times out
 * thirty seconds later saying nothing about why. `selector()` is the client's,
 * through the one door the suite may spell.
 *
 * THE INNER IDS ARE TABLE ENTRIES NOW — the same table the containers come
 * from — so a renamed `hledger-txn` is a compile error here rather than a
 * locator that matches nothing. They are collected here for the same reason
 * the containers are: one spelling, beside the row's steps.
 */

import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

/** The page's chrome: the one-line summary and the three-view strip. */
export const HLEDGER_HEADER = selector(TESTID.ledgerHeader);
export const HLEDGER_TAB = selector(TESTID.ledgerTab);

/** The three panels, one of which is on screen at a time. */
export const HLEDGER_TRANSACTIONS = selector(TESTID.ledgerTransactions);
export const HLEDGER_BALANCES = selector(TESTID.ledgerBalances);
export const HLEDGER_RAW = selector(TESTID.ledgerRaw);

/** What the page is not showing, when it is not showing all of it. */
export const HLEDGER_SAID = selector(TESTID.ledgerSaid);

/** One transaction, one posting, and the comment and tags written under a
 *  transaction's header or a posting. */
export const HLEDGER_TXN = selector(TESTID.ledgerTxn);
export const HLEDGER_POSTING = selector(TESTID.ledgerPosting);
export const HLEDGER_TXN_COMMENT = selector(TESTID.ledgerTxnComment);
export const HLEDGER_POSTING_COMMENT = selector(TESTID.ledgerPostingComment);
export const HLEDGER_TAG = selector(TESTID.ledgerTag);
export const HLEDGER_RAW_LINE = selector(TESTID.ledgerRawLine);

/** One account of the balances tree, and its per-commodity totals. */
export const HLEDGER_BALANCE = selector(TESTID.ledgerBalance);
export const HLEDGER_BALANCE_AMOUNT = selector(TESTID.ledgerBalanceAmount);
