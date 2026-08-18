/**
 * A note as one clamped line, chosen by a QUERY — ./preview.ts's sibling, and
 * the reason they are siblings rather than one function with a mode.
 *
 * Both answer "this note, as the one dim line that hangs under a title", in
 * the same slot with the same clamp; they differ in which line, and that is a
 * real difference rather than a parameter. ./preview.ts reads the TOP of a
 * note and may tidy it — a preview is about what the note opens with, so
 * dropping the marks around a word leaves the words. This one is about a
 * POSITION in one, and dropping characters would move the hit away from the
 * offsets the matcher found it at; so the marks stay, and what a reader sees
 * is what the note says around the word they typed.
 *
 * The third of the three things a filtered row has to say. A node matched on
 * its `desc` draws a title holding nothing the reader typed — every word of
 * the reason is behind the ¶ — so the row draws a WINDOW onto the note around
 * the first hit, dim under the title, with the words lit exactly as they are
 * in a title (`../filter/lit.ts`).
 *
 * NOT THE WHOLE NOTE, and the alternative is worth naming because it is the
 * obvious one: auto-expanding a matched note. It was ruled out on three counts
 * (human, 2026-08-18) — notes here run to ~1.5KB paragraphs, so a filtered page
 * of them is a wall; the filter re-evaluates on every keystroke, so the page
 * would reflow violently under somebody still typing; and it would trample the
 * reader's own open/closed state, which would then need saving and restoring to
 * put back. A clamped window is the same idea with a bounded cost.
 *
 * PLAIN TEXT, never rendered markdown — ./preview.ts's ruling, inherited for
 * its reason: this sits under a title, and a heading or a list drawn there
 * would be a note pretending to be a row.
 */

import { litBy } from "@olai/format"

import { type Run, runsIn } from "../filter/lit.ts"

/** How much note a hit is read in — wide enough for the phrase around a word,
 *  short enough to stay one line beside a title that is already ellipsized. */
const WIDTH = 140

/** How much of that window may sit BEFORE the hit, when the hit's own line
 *  starts further back than that. A hit dropped at the left edge reads as the
 *  start of the note; a little run-up is what says "in the middle of this". */
const LEAD = 40

/** The mark at either end, for a window that did not start where the note did
 *  or stop where it stops. One character, and the typographer's rather than
 *  three dots. */
const ELLIPSIS = "…"

/**
 * The line, as the runs it is drawn from — or `undefined` when none of the
 * needles is in this note at all, which is every row the caller should not be
 * asking about.
 *
 * The window OPENS AT THE HIT'S OWN LINE where it can, and that is the rule
 * worth naming: a note is written in lines, and the sentence a word is in
 * begins where its paragraph or its list item does — a window that opened a
 * fixed number of characters back instead would start halfway through the item
 * above and read as noise. {@link LEAD} is the floor for a line too long to
 * open at, and the ellipsis says which happened.
 *
 * The runs are cut from the landings themselves — `./lit.ts`'s `runsIn`, which
 * argues why the bounds rather than a second search. Newlines are folded to spaces INSIDE each run, after the cut, for the reason
 * the bounds are taken over the note's own offsets: a collapse before it would
 * have moved every landing.
 */
export const excerptOf = (
  desc: string,
  needles: ReadonlyArray<string>,
): ReadonlyArray<Run> | undefined => {
  const hits = litBy(desc, needles)
  const first = hits[0]
  if (first === undefined) return undefined
  const opens = lineStart(desc, first.at)
  const from = wordEdge(desc, Math.max(opens, first.at - LEAD), opens)
  const to = Math.min(desc.length, Math.max(from + WIDTH, first.end))
  const runs: ReadonlyArray<Run> = runsIn(desc, hits, from, to)
    .map((run) => ({ text: oneLine(run.text), lit: run.lit }))
  const opened = from > 0 ? [{ text: ELLIPSIS, lit: false }, ...runs] : runs
  return to < desc.length ? [...opened, { text: ELLIPSIS, lit: false }] : opened
}

/** Where the hit's own line begins — the note's own idea of where a sentence
 *  starts, which is what makes a one-line window read as a sentence. */
const lineStart = (desc: string, at: number): number =>
  desc.lastIndexOf("\n", at) + 1

/** The start of the word this offset lands inside — so a window that had to
 *  cut into a long line opens on a whole word rather than three letters of
 *  one.
 *
 *  FLOORED AT THE LINE, which is the half that is not tidiness: without it the
 *  search for a space walks back THROUGH the newline into the item above, and
 *  the window opens on the last word of a sentence it is not about. Bounded by
 *  the lead as well, so a line with no space in reach is cut where the
 *  arithmetic said rather than opened at its start. */
const wordEdge = (desc: string, at: number, floor: number): number => {
  if (at <= floor) return floor
  const space = desc.lastIndexOf(" ", at)
  return space < floor || at - space > LEAD ? at : space + 1
}

/** Every run of whitespace as one space — what makes a window over a
 *  paragraphed note one line. */
const oneLine = (text: string): string => text.replace(/\s+/g, " ")
