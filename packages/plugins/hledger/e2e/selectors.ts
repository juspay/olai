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
export const HLEDGER_LINK = selector(TESTID.hledgerLink);

/** The page's chrome: the one-line summary row (whose facts are separate
 *  spans) and the three-view strip. */
export const HLEDGER_HEADER = selector(TESTID.hledgerHeader);
export const HLEDGER_FACT = selector(TESTID.hledgerFact);
export const HLEDGER_UNREADABLE = selector(TESTID.hledgerUnreadable);
export const HLEDGER_TAB = selector(TESTID.hledgerTab);

/** The three panels, one of which is on screen at a time. The third is the
 *  file's own bytes, under a line-number gutter. */
export const HLEDGER_TRANSACTIONS = selector(TESTID.hledgerTransactions);
export const HLEDGER_BALANCES = selector(TESTID.hledgerBalances);
export const HLEDGER_SOURCE = selector(TESTID.hledgerSource);

/** What the page is not showing, when it is not showing all of it. */
export const HLEDGER_SAID = selector(TESTID.hledgerSaid);

/** The month band a run of transactions sits under, and the empty state a
 *  file with no records draws. */
export const HLEDGER_MONTH = selector(TESTID.hledgerMonth);
export const HLEDGER_EMPTY = selector(TESTID.hledgerEmpty);

/** One transaction and the pieces the redesign drew out of its head: the note
 *  on its own, the comment's prose on its own (the tags are pills), and the
 *  status mark. */
export const HLEDGER_TXN = selector(TESTID.hledgerTxn);
export const HLEDGER_TXN_NOTE = selector(TESTID.hledgerTxnNote);
export const HLEDGER_TXN_COMMENT = selector(TESTID.hledgerTxnComment);
export const HLEDGER_STATUS = selector(TESTID.hledgerStatus);
export const HLEDGER_TAG = selector(TESTID.hledgerTag);

/** The date a transaction opens with — its own column on a laptop, the bare
 *  day beside the payee on a phone. */
export const HLEDGER_DATE = selector(TESTID.hledgerDate);
export const HLEDGER_DAY = selector(TESTID.hledgerDay);

/** One posting: its account, the amount's two cells (the number, and the tail
 *  a suffix commodity or an annotation goes in) and the annotations. */
export const HLEDGER_POSTING = selector(TESTID.hledgerPosting);
export const HLEDGER_POSTING_COMMENT = selector(TESTID.hledgerPostingComment);
export const HLEDGER_ACCOUNT = selector(TESTID.hledgerAccount);
export const HLEDGER_AMOUNT = selector(TESTID.hledgerAmount);
export const HLEDGER_AMOUNT_TAIL = selector(TESTID.hledgerAmountTail);
export const HLEDGER_COST = selector(TESTID.hledgerCost);
export const HLEDGER_ASSERTION = selector(TESTID.hledgerAssertion);
export const HLEDGER_INFERRED = selector(TESTID.hledgerInferred);

/** One account of the balances tree, its commodities' columns, the header band
 *  that names those columns, the chevron that folds a parent and the depth
 *  control. */
export const HLEDGER_BALANCE = selector(TESTID.hledgerBalance);
export const HLEDGER_BALANCE_AMOUNT = selector(TESTID.hledgerBalanceAmount);
export const HLEDGER_BALANCE_EMPTY = selector(TESTID.hledgerBalanceEmpty);
export const HLEDGER_BALANCE_TOGGLE = selector(TESTID.hledgerBalanceToggle);
export const HLEDGER_BALANCE_HEAD = selector(TESTID.hledgerBalanceHead);
export const HLEDGER_BALANCE_COMMODITY = selector(TESTID.hledgerBalanceCommodity);
export const HLEDGER_DEPTH = selector(TESTID.hledgerDepth);

/** One line of the source view: its gutter number and the line's own text. */
export const HLEDGER_SOURCE_LINE = selector(TESTID.hledgerSourceLine);
export const HLEDGER_SOURCE_NUMBER = selector(TESTID.hledgerSourceNumber);
