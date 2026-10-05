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
 * from — so a renamed `ledger-txn` is a compile error here rather than a
 * locator that matches nothing. They are collected here for the same reason
 * the containers are: one spelling, beside the row's steps.
 */

import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

/** The sidebar row a served ledger file is listed as — the row the tree steps
 *  grip, so a scenario never names the harness's kind table for a kind only
 *  this row draws. */
export const LEDGER_LINK = selector(TESTID.ledgerLink);

/** The page's chrome: the one-line summary and the three-view strip. */
export const LEDGER_HEADER = selector(TESTID.ledgerHeader);
export const LEDGER_TAB = selector(TESTID.ledgerTab);

/** The three panels, one of which is on screen at a time. */
export const LEDGER_TRANSACTIONS = selector(TESTID.ledgerTransactions);
export const LEDGER_BALANCES = selector(TESTID.ledgerBalances);
export const LEDGER_RAW = selector(TESTID.ledgerRaw);

/** What the page is not showing, when it is not showing all of it. */
export const LEDGER_SAID = selector(TESTID.ledgerSaid);

/** One transaction, one posting, and the comment and tags written under a
 *  transaction's header or a posting. */
export const LEDGER_TXN = selector(TESTID.ledgerTxn);
export const LEDGER_POSTING = selector(TESTID.ledgerPosting);
export const LEDGER_TXN_COMMENT = selector(TESTID.ledgerTxnComment);
export const LEDGER_POSTING_COMMENT = selector(TESTID.ledgerPostingComment);
export const LEDGER_TAG = selector(TESTID.ledgerTag);
export const LEDGER_RAW_LINE = selector(TESTID.ledgerRawLine);

/** One account of the balances tree, and its per-commodity totals. */
export const LEDGER_BALANCE = selector(TESTID.ledgerBalance);
export const LEDGER_BALANCE_AMOUNT = selector(TESTID.ledgerBalanceAmount);
