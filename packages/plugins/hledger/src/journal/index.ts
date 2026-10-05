/**
 * THE JOURNAL READER'S DOOR — the smallest surface `../browser/` needs, and
 * nothing else.
 *
 * A reader this size has more names than a page does: modules for the decimal,
 * the date, the amount, the tags, the line, the header, the posting, the group,
 * the inference, the balances and the bounds. The page draws a journal, the
 * accounts it nets to and the file's own bytes, and it should not have to know
 * which of those modules a name came from. So this is the one import the
 * browser half spells, and the modules behind it stay free to move.
 */
export { readJournal } from "./read.ts"
export type { Balances, Journal, Transaction } from "./read.ts"
export { type Amount, type Style } from "./amount.ts"
export type { Posting } from "./posting.ts"
export type { Tag } from "./tags.ts"
/** The number under an amount, as the text it was written as — the display
 *  builds a quantity's spelling from it (`../browser/spell.ts`). */
export { text as decimalText, type Decimal } from "./decimal.ts"
export { HLEDGER_CELL, HLEDGER_LINES, HLEDGER_TRANSACTIONS } from "./bounds.ts"
