/**
 * THE BACKTICKS IN A QUOTED SENTENCE — the one piece of markup a machine's row
 * draws, and the reason it is exactly one.
 *
 * A `user` row is QUOTED, NOT RENDERED, and that rule is older than this file
 * and is not being relaxed ({@link ./Entry.tsx}, {@link ./Rang.tsx}): what a
 * person typed is drawn character for character, and a plugin's sentence is
 * drawn the same way because the mark that says a plugin said it does not
 * survive a replay — a body markdown-rendered only while that mark is live
 * would come back as raw hashes and bullets the first time somebody resumed the
 * conversation.
 *
 * ## What changed, and why it is not that rule bending
 *
 * A plugin now names the node it is ringing about, in backticks, inside its
 * account — `` on `lane-sd` `` — and an id in backticks is a REFERENCE this
 * panel already knows how to make pressable ({@link ./refs.ts}: a `<code>` span
 * whose text the set declares, asked of the server through
 * {@link ./declared.ts}). That pass walks `<code>` elements, and a quoted
 * paragraph has none — so the id sat there as three words a reader had to copy
 * out and search for, in the one row whose whole purpose is to point at
 * something.
 *
 * This module is the smallest thing that closes it: the sentence is split into
 * the runs between backticks and the runs inside them, nothing else is
 * interpreted, and the caller draws the inside ones as `<code>`. No headings,
 * no lists, no emphasis, no links, no fences — none of markdown, in other
 * words, except the one construct the reference pass is defined over.
 *
 * ## Why the backticks come OFF, when the rule is verbatim
 *
 * Because the panel already draws it that way one row up. An id the AGENT names
 * goes through the markdown pipeline and lands as a code chip WITHOUT its
 * backticks — that is what a code span is — and a plugin's identical sentence
 * drawing `` `lane-sd` `` with the quotes still on would be two looks for one
 * thing in one column. The reader's question is *which node*, and the answer to
 * it is the same shape whoever wrote the sentence.
 *
 * What that costs is honest and is the same cost the row's whole face already
 * carries: on a replay the mark is gone, the row is drawn as an ordinary quoted
 * message, and the backticks are back. The face, the fold and the byline vanish
 * with it. A pressable id is one more LIVE affordance over a sentence that
 * reads correctly without any of them — which is the bargain {@link ./Rang.tsx}
 * makes in its own words, applied one layer in.
 *
 * ## Why a module
 *
 * {@link ./byline.ts}'s reason, word for word: it is a rule about text, every
 * way of getting it wrong is a reader shown the wrong half of somebody else's
 * sentence as a chip, and checking it should not require a browser and a plugin
 * ringing a real doorbell.
 */

/** One stretch of a quoted sentence: the words, and whether they were between
 *  backticks. */
export interface Run {
  /** Was this between backticks — i.e. does it draw as a `<code>` and go to the
   *  id lookup ({@link ./refs.ts}). */
  readonly code: boolean
  /** The words themselves, with the backticks off a code run and everything
   *  else exactly as the author wrote it. */
  readonly text: string
}

/**
 * A PAIR OF BACKTICKS ON ONE LINE, with something between them.
 *
 * Every clause is a refusal, and each is a way this could have eaten a sentence
 * nobody meant as markup:
 *
 *   - `[^`\n]` — no BACKTICK inside, so ``` ``x`` ``` is not one span with a
 *     stray tick in it, and no NEWLINE, so a lone backtick in one paragraph
 *     cannot reach forward and swallow the three lines to the next one. A body
 *     that opens a quote and never closes it is the ordinary shape of a
 *     sentence about shell syntax, and it must draw as its own words.
 *   - `+` — a pair with nothing between it (` `` `) is two characters somebody
 *     typed, not an empty chip.
 *
 * Deliberately NOT markdown's rule, which counts the opening run of ticks and
 * looks for a run of the same length, strips one space either side, and lets a
 * span cross lines. That rule exists to render documents; this one exists to
 * find the ids in a sentence, and the every-way-it-differs is a way it draws
 * LESS.
 */
const SPAN = /`([^`\n]+)`/g

/**
 * The sentence, split.
 *
 * Total: a body with no backticks in it comes back as one plain run, and an
 * empty body as no runs at all — so a caller draws the answer without asking
 * first whether the split found anything.
 *
 * Empty plain runs are dropped, because a chip at the very start of a sentence
 * or two chips side by side would otherwise put an empty text node between
 * them, which is a node the DOM has to carry and nobody can see.
 */
export const quotedRuns = (text: string): ReadonlyArray<Run> => {
  const runs: Array<Run> = []
  let at = 0
  for (const found of text.matchAll(SPAN)) {
    const said = found[1]
    if (said === undefined) continue
    const before = text.slice(at, found.index)
    if (before !== "") runs.push({ code: false, text: before })
    runs.push({ code: true, text: said })
    at = found.index + found[0].length
  }
  const rest = text.slice(at)
  if (rest !== "") runs.push({ code: false, text: rest })
  return runs
}
