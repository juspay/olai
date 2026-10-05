/**
 * WHAT A `.journal`'s PAGE IS NOT SHOWING, and why — the one line under the
 * panels.
 *
 * It is HERE and not in the format, and that is the layering rather than a
 * convenience. `../journal/read.ts` answers in FACTS — the transactions
 * it kept, and whether the reading ran out of lines or transaction headers —
 * because what a journal says is a fact about the file. What a READER is told
 * about it is this client's vocabulary, the way what a reader calls each kind
 * of file is (`../file/kinds.ts`'s `NAMED`, which the reading cannot import for
 * the same reason). Nothing else in the reading writes a sentence for a
 * person; a function that did would be the floor deciding how the roof speaks.
 *
 * ONE SENTENCE FOR EVERYTHING a page can be not showing, because a reader asks
 * one question — *where is the rest of my file* — and three lines answering it
 * in three voices is three things to find. `null` is the other answer and the
 * ordinary one: the whole file is on the screen, so there is nothing to say and
 * nothing is drawn.
 *
 * IT SAYS "THE FIRST 1,000 TRANSACTIONS" AND NOT "OF 12,431", and the missing
 * total is the honest half of the correction the reading took. A total is a
 * number only a full scan knows, and the scan stops at the bound precisely so
 * that a journal with tens of thousands of transactions is not read to print a
 * figure the bound exists to avoid reading (`../journal/read.ts`
 * argues it). What the page can say is that there was more, which is the same
 * warning at none of the cost. The two bounds are named rather than counted
 * off the reading, because the reading stopped and never learned the totals.
 *
 * AN EMPTY FILE IS SAID FIRST, because it is the one answer that wraps the
 * others: a file with no transactions and no directives has nothing for a
 * bound to have cut short, and "showing the first 1,000 transactions" over
 * nothing is nonsense a reader would have to reconcile.
 *
 * AN ASIDE, never an alarm. Nothing was refused and nothing failed: a bound was
 * reached, or the file really is empty. `@olai/web/client/SaidLine.tsx` is what
 * turns that mood into a `role` and an `aria-live`, and the reason it is a
 * value here rather than markup is that the mood is the decision and the markup
 * is not.
 */

import { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS, type Journal } from "../journal/index.ts"

import type { Said } from "@olai/web/client/saying.ts"

export const ledgerSaid = (ledger: Journal): Said | null => {
  // A FILE WITH NOTHING AT ALL is said rather than drawn as empty panels: a
  // journal nobody has written a line into is a real thing to find out, and a
  // reader shown three empty views learns it by elimination.
  if (ledger.transactions.length === 0 && ledger.entries.length === 0) {
    return { tone: "aside", text: "This file is empty." }
  }
  // Each clause only when that bound really ran out: a file with nine hundred
  // transactions and a short line count is owed no word about its lines, and
  // being told about them anyway teaches a reader to skip the line that matters.
  // The order is the reading's own: transactions were counted first, and lines
  // are what stopped the count.
  const said: Array<string> = []
  if (ledger.moreTransactions) {
    said.push(`Showing the first ${grouped(HLEDGER_TRANSACTIONS)} transactions.`)
  }
  if (ledger.truncated) {
    said.push(`The file is longer than ${grouped(HLEDGER_LINES)} lines; only the beginning was read.`)
  }
  // THE CELL IS ITS OWN SENTENCE rather than a third clause of the reading's,
  // because it is a different kind of fact: the two above say how much of the
  // file was read, and this one says that a field that WAS read was shortened.
  if (ledger.longCells) {
    said.push(`Long lines are cut at ${grouped(HLEDGER_CELL)} characters.`)
  }
  return said.length === 0 ? null : { tone: "aside", text: said.join(" ") }
}

/**
 * A count with thousands separated — `1,000`.
 *
 * A fact about reading a number off a screen rather than a locale: four digits
 * in a row is a number a reader has to count. `Intl` per render for a thousands
 * separator would be a dependency on the reader's machine for one character,
 * and these counts are transactions in a file rather than money.
 */
const grouped = (count: number): string => {
  const digits = String(count)
  let out = ""
  for (let at = 0; at < digits.length; at++) {
    if (at > 0 && (digits.length - at) % 3 === 0) out += ","
    out += digits[at]
  }
  return out
}
