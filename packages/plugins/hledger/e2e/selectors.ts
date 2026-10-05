/**
 * THIS ROW'S SELECTORS — an hledger page's own ids, spelled once, for its own
 * steps.
 *
 * The seven container ids come from `../src/testids.ts`, which is this
 * package's own file: a rename there is a type error here rather than a
 * scenario that times out thirty seconds later saying nothing about why.
 * `selector()` is the client's, through the one door the suite may spell.
 *
 * THE INNER IDS ARE LITERALS, and that is not a second convention: this row
 * exports only its seven containers (`../src/testids.ts`, whose own comment
 * says why the panel's inner marks are plain `data-testid` strings rather than
 * entries in a table nothing else reads), so there is nothing to import for
 * them. They are collected here for the same reason the containers are — one
 * spelling, beside the row's steps.
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
 *  transaction's header. */
export const HLEDGER_TXN = '[data-testid="hledger-txn"]';
export const HLEDGER_POSTING = '[data-testid="hledger-posting"]';
export const HLEDGER_TXN_COMMENT = '[data-testid="hledger-txn-comment"]';
export const HLEDGER_TAG = '[data-testid="hledger-tag"]';

/** One account of the balances tree, and its per-commodity totals. */
export const HLEDGER_BALANCE = '[data-testid="hledger-balance"]';
export const HLEDGER_BALANCE_AMOUNT = '[data-testid="hledger-balance-amount"]';
