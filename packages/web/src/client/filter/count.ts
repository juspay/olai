/**
 * What a filtered page says about its own numbers, as one sentence.
 *
 * THE DEFECT IT WAS WRITTEN FOR is arithmetic that did not add up. The line
 * used to read "8 of 57 — 17 more matches are hidden as done", and a reader who
 * did the sum got 25 matches on a page of 57 rows — except the 17 were not
 * among the 57 at all: the 57 counted the rows LEFT after finished work was
 * taken off, and the 17 counted matches that were taken off with it. Two
 * numbers, two different universes, one sentence
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-in-place.md filed it, and this is the fix).
 *
 * So the numbers here are one universe: the rows the page HOLDS, before any
 * preference of this reader's takes something off it. Of those, some matched
 * and are drawn; some matched and are not drawn, and the sentence says WHY;
 * the rest did not match. Nothing is counted twice and nothing is counted
 * against a set it is not in.
 *
 * A FUNCTION rather than lines inside the bar, because a sentence assembled in
 * a JSX binding is a sentence no test can ask about. What it takes is three
 * numbers ({@link Counts}) rather than the reading itself: this file has no
 * business tracking a signal, and a caller that can hand it three numbers can
 * hand it three numbers from a test.
 *
 * WHAT IS NOT SAID IS THE ZERO. A part that is zero is a part the reader does
 * not need — a page with nothing held back says nothing about holding anything
 * back, rather than "0 hidden", which is a number somebody has to read before
 * they can ignore it.
 */

/**
 * The three numbers a filtered page knows about itself
 * (`./narrowing.ts` derives all three from the sets the page is drawn from).
 */
export interface Counts {
  /** Matched, and DRAWN — the rows in front of the reader that the query
   *  selected, ancestors kept for context not among them. */
  readonly shown: number
  /** Every place the page holds, whatever this reader's preferences draw of
   *  it. The denominator, and the set the other two are counted inside. */
  readonly held: number
  /**
   * Matched, and NOT drawn, because this page hides finished work. The one
   * hider there is; a second one would be a second field and a second clause,
   * never a lump sum, since the sentence's job is to say which.
   *
   * WHAT THE PREFERENCE TOOK OFF, which is a shade wider than "rows that store
   * `done`": hiding a finished row takes its subtree with it
   * (`../settings/done.ts`), so a match beneath one is counted here — hidden,
   * and hidden BY the pick this page answers to — the panel's default or
   * this page's own out-vote, the sentence does not distinguish them
   * because the reader need not either: the clause names the pickup point,
   * the flip beside this bar is where they'd go to argue.
   */
  readonly hiddenAsDone: number
}

/** What an unfiltered page has found — ONE value, shared, for the reason
 *  `./narrowing.ts`'s `NOTHING_MATCHED` is one: a page with no filter on it
 *  produces this on every revision the store publishes, and a fresh record per
 *  frame is a fresh value per frame for whatever memoises against it. */
export const NOTHING_COUNTED: Counts = { shown: 0, held: 0, hiddenAsDone: 0 }

/**
 * The sentence — "8 of 57", plus the clause a hider earns.
 *
 * The zero case keeps the denominator, and that is the half of the line most
 * worth having: "no matches of 57" says the page holds 57 rows and the query is
 * what emptied it, where a bare "no matches" reads exactly like a directory
 * with nothing in it.
 *
 * "MORE" IS DROPPED WHEN NOTHING IS DRAWN, because there is nothing for the
 * held-back matches to be more THAN — "no matches of 57 — 3 more matches
 * hidden" is a line that contradicts itself in eight words.
 */
/**
 * What the line says INSTEAD of the numbers while the rows on screen answer a
 * query the reader has already moved on from (`./narrowing.ts`'s `answering`).
 *
 * A word rather than the last query's count, because a count is a claim about
 * what was typed: "1 of 10" over rows that answer the query before it is the
 * one sentence this file exists to prevent, arithmetic that does not add up.
 * The rows themselves hold still — they are somebody's reading — and this is
 * the label that keeps them honest for the beat it takes.
 *
 * IN THE SAME ELEMENT as the numbers, so there is one place a reader looks for
 * "what does this page have to say about my query" and one place a scenario
 * reads it from.
 */
export const ANSWERING = "filtering…"

export const countLine = ({ shown, held, hiddenAsDone }: Counts): string => {
  const found = shown === 0 ? `no matches of ${held}` : `${shown} of ${held}`
  if (hiddenAsDone === 0) return found
  const more = shown === 0 ? "" : "more "
  const matches = hiddenAsDone === 1 ? "match" : "matches"
  return `${found} — ${hiddenAsDone} ${more}${matches} hidden as done`
}

/**
 * WHAT THE ONE LINE SAYS, over the states a filtered page can be in —
 * `null` for the state where the honest thing is to say nothing.
 *
 *   - the rows answer what is typed → the numbers;
 *   - nothing has answered it and the last call FAILED → nothing, because the
 *     line beside it is already the news and a wait word would be a promise
 *     nobody is keeping: no answer is coming until something changes;
 *   - nothing has answered it yet → {@link ANSWERING}, which is true.
 *
 * A FUNCTION rather than a ternary in the bar, for the reason `countLine` is
 * one: the second case was a bug before it was a rule (a first query that
 * failed left `filtering…` up for good), and a decision that lives in a JSX
 * binding is a decision no test can ask about.
 */
export const countSaid = (said: {
  /** Which query the rows answer, `null` when none answers what is typed. */
  readonly answering: string | null
  /** The last call's refusal, in the server's own words. */
  readonly failure: string | null
  readonly counts: Counts
}): string | null => {
  if (said.answering !== null) return countLine(said.counts)
  // THE WAIT WORD IS A PROMISE, so it may only be said while something is
  // actually on its way. A failed call is "no answer is coming until something
  // changes", and it has its own line under this one; `filtering…` over it
  // would be the page waiting for a fetch nobody is making. A DEAD WIRE used to
  // be the second half of this sentence, and it is the offline overlay's now
  // (`../connection/Offline.tsx`): the whole page is behind it, this line
  // included.
  return said.failure === null ? ANSWERING : null
}
