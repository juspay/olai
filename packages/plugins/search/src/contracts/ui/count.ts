/**
 * What a SHORTLIST says about the answer it only drew part of.
 *
 * THE DEFECT IT WAS WRITTEN FOR is a door that cannot count past eight. Both
 * doors onto the one reading — the ⌘K palette and the header's box — ask for
 * {@link ./nodes.ts}'s `LIMIT` hits and draw exactly what comes back, so a
 * query that matched ninety nodes and a query that matched eight were the same
 * eight rows and the same silence underneath them. The number was never
 * missing from the wire: a search answers with the uncapped `total` beside its
 * capped `hits` precisely so that "eight of ninety" is sayable
 * (`@olai/format`'s `searching.ts`, `@olai/ops`' `query.ts`), and the browser
 * read one field and dropped the other. The filtered page has said all three of
 * its truths since #248 (`../filter/count.ts`); this is the same honesty at the
 * two doors that were left out of it.
 *
 * A FUNCTION rather than lines inside two components, for that file's reason
 * twice over: a sentence assembled in a JSX binding is a sentence no test can
 * ask about, and a sentence assembled in TWO of them is two sentences one
 * rename away from disagreeing. One reading, two doors, one line about it.
 *
 * WHAT IS NOT SAID IS THE WHOLE ANSWER. A door that drew everything it found
 * says nothing — "8 of 8 matches" is a number a reader has to take in before
 * they can ignore it, and the rows themselves already say how many there are.
 * The line appears exactly when there is something behind the rows, which is
 * the only moment it carries news.
 *
 * IT IS ABOUT THE HITS, never about the list. The palette draws its shell
 * commands, the page's own verbs and the pin row above the hits, and none of
 * those came from the server or are counted in anything here — which is why
 * the sentence names its subject (`matches`) rather than leaving two bare
 * numbers under a list whose top half they say nothing about.
 */

/** The two numbers a door knows about one answer — both read off the same
 *  value, which is what keeps them from being arithmetic from two moments
 *  (`./nodes.ts` hands back an answer that carries its own total). */
export interface Drawn {
  /** The rows this door drew: the hits it was sent, capped server-side. */
  readonly drawn: number
  /** How many matched in all, uncapped — the denominator the wire has been
   *  carrying all along. */
  readonly total: number
}

/**
 * The line — "8 of 90 matches" — or `null` when the honest thing is to say
 * nothing.
 *
 * A total that is not GREATER than what was drawn is that silence, and the
 * comparison is deliberately not an equality: the two numbers ride on one
 * answer today, so `total < drawn` cannot happen, and the day it can, a line
 * reading "9 of 2 matches" would be worse than no line at all.
 */
export const countLine = ({ drawn, total }: Drawn): string | null =>
  total > drawn ? `${drawn} of ${total} matches` : null
