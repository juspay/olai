/**
 * HOW MUCH OF A MACHINE'S SENTENCE THE PANEL DRAWS — one line, or the whole of
 * it, and which of those a reader is owed before they have pressed anything.
 *
 * A plugin's doorbell delivers a body several paragraphs long: a terminal id,
 * the step it is claiming, the sentence the claim was derived from, the whole
 * standing set, and the line saying how to make it stop
 * ({@link ../../../../plugin-kolu/src/doorbell.ts}). Every one of those is
 * worth having and none of them is worth ten lines of transcript, unasked, in
 * the lane a person's own words go out on. So the row FOLDS: the plugin's
 * opening line alone, with the rest one press away — the same discipline the
 * tool row has always kept ({@link ./ToolFrame.tsx}: one folded line, the
 * detail in the fold).
 *
 * ## Why the two audiences split here and nowhere else
 *
 * THE AGENT STILL RECEIVES THE WHOLE BODY. It is the message text on the wire
 * and this module cannot reach it: an agent that has to act on a doorbell needs
 * the terminal id to look the terminal up, the derivation to know whether the
 * claim still holds, and the standing set to know what else is waiting — and a
 * summary is exactly the half of that which is unactionable. What changes is
 * only what the PANEL draws, which is a fact about a reader's eye and about
 * nothing else. Folding on the wire instead would have been the same feature
 * with the cost moved onto the one party that cannot press an expand.
 *
 * ## Why the seam is the plugin's own first line
 *
 * The fold needs a line worth folding TO, and this client does not compose one.
 * The seam is {@link ./byline.ts}'s split — the sentence's first line, which
 * the plugin authored and which `Deliveries.deliver` already requires it to
 * open with. Core summarising a plugin's paragraph into a headline is core
 * writing the plugin's words with none of what it takes to write them well: it
 * does not know which terminal matters, what the wake means, or which half of
 * the account is the news. It would also be a summary that could be WRONG about
 * a body nobody here wrote, which is worse than a long row — a long row is only
 * long. So the essence line is authored where the facts are, and the panel's
 * whole contribution is to draw it first and hold the rest back.
 *
 * And where there is no such line, there is NO FOLD. A body that carries no
 * opening attribution ({@link ./byline.ts} answers `byline: ""` for it) has
 * nothing to fold to, so it draws whole, with no control on it — never a
 * first-sentence-and-ellipsis this module invented, and never a control that
 * hides words behind a label the reader has no reason to trust.
 *
 * ## Why a module
 *
 * {@link ./face.ts}'s reason, word for word: this is a precedence over text,
 * every way of getting it wrong is a reader shown the wrong amount of somebody
 * else's sentence, and checking it should not require a browser and a plugin
 * ringing a real doorbell. The component keeps the DOM; the rule lives here
 * where a test can hold it.
 */

import { bylineOf } from "./byline.ts"

/** A machine's sentence, as the row draws it. */
export interface RangRow {
  /** The plugin's own attribution line — the folded face of the row — or `""`
   *  when the body carries none. {@link ./byline.ts} for why it is never
   *  composed here. */
  readonly byline: string
  /** Everything under it, and the WHOLE text when there is no byline. Always
   *  present, whether or not it is drawn: the caller decides visibility off
   *  {@link RangRow.open}, and a body that vanished from the answer would be a
   *  second place for "is there anything to show" to be decided. */
  readonly body: string
  /** Is there anything to press — i.e. does this row have an essence line
   *  distinct from its account. False means the row is one paragraph and draws
   *  as it always did, with no expand affordance at all. */
  readonly folds: boolean
  /** Is the body on screen. True for a row that does not fold — the words are
   *  the row — and for a folded row the reader has opened. */
  readonly open: boolean
}

/**
 * What to draw for this body, given whether the reader has opened this row
 * ({@link ./folds.ts} holds that, keyed by the entry's id, so a fold survives
 * the panel being closed and reopened).
 *
 * Total: every arm answers with a `body` and a boolean saying whether it shows,
 * so the component never has to ask which case it is in before drawing.
 */
export const rangRow = (text: string, unfolded: boolean): RangRow => {
  const said = bylineOf(text)
  const folds = said.byline !== ""
  // A ROW WITH NO FOLD IS ALWAYS OPEN — not "closed and un-openable", which is
  // the same pixels and a different claim: it would let a caller draw a control
  // for a fold that does not exist, and would make the reader's `unfolded` bit
  // decide the visibility of a body that has no other way to be seen.
  return { byline: said.byline, body: said.body, folds, open: !folds || unfolded }
}
