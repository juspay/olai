/**
 * THIS ROW'S SELECTORS — an hledger page's own ids, spelled once, for its own
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
export const HLEDGER_HEADER = selector(TESTID.hledgerHeader);
export const HLEDGER_TAB = selector(TESTID.hledgerTab);

/** The three panels, one of which is on screen at a time. */
export const HLEDGER_TRANSACTIONS = selector(TESTID.hledgerTransactions);
export const HLEDGER_BALANCES = selector(TESTID.hledgerBalances);
export const HLEDGER_RAW = selector(TESTID.hledgerRaw);

/** What the page is not showing, when it is not showing all of it. */
export const HLEDGER_SAID = selector(TESTID.hledgerSaid);

/** One transaction, one posting, and the comment and tags written under a
 *  transaction's header or a posting. */
export const HLEDGER_TXN = selector(TESTID.hledgerTxn);
export const HLEDGER_POSTING = selector(TESTID.hledgerPosting);
export const HLEDGER_TXN_COMMENT = selector(TESTID.hledgerTxnComment);
export const HLEDGER_POSTING_COMMENT = selector(TESTID.hledgerPostingComment);
export const HLEDGER_TAG = selector(TESTID.hledgerTag);
export const HLEDGER_RAW_LINE = selector(TESTID.hledgerRawLine);

/** One account of the balances tree, and its per-commodity totals. */
export const HLEDGER_BALANCE = selector(TESTID.hledgerBalance);
export const HLEDGER_BALANCE_AMOUNT = selector(TESTID.hledgerBalanceAmount);
