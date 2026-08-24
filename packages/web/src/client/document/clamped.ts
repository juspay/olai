/**
 * WHAT A `.csv`'s PAGE IS NOT SHOWING, and why — the one sentence under the
 * table.
 *
 * It is HERE and not in the format, and that is the layering rather than a
 * convenience. `@olai/format`'s `csv.ts` answers in FACTS — the rows it kept,
 * and whether each axis ran out — because what a `.csv` says is a fact about
 * the file. What a READER is told about it is this client's vocabulary, the way
 * what a reader calls each kind of file is (`../file/kinds.ts`'s `NAMED`, which
 * the format cannot import for the same reason). Nothing else in
 * `@olai/format` writes a sentence for a person; a function that did would be
 * the floor deciding how the roof speaks.
 *
 * ONE SENTENCE FOR EVERYTHING a page can be not showing, because a reader asks
 * one question — *where is the rest of my file* — and three lines answering it
 * in three voices is three things to find. `null` is the other answer and the
 * ordinary one: the whole file is on the screen, so there is nothing to say and
 * nothing is drawn.
 *
 * IT SAYS "THE FIRST 500 ROWS" AND NOT "OF 12,431", and the missing total is
 * the honest half of the correction the reading took. A total is a number only
 * a full scan knows, and the scan stops at the bound precisely so that a
 * million-row export is not read to print a figure the bound exists to avoid
 * reading (`@olai/format`'s `csv.ts` argues it). What the page can say is that
 * there was more, which is the same warning at none of the cost.
 *
 * AN ASIDE, never an alarm. Nothing was refused and nothing failed: a bound was
 * reached, or the file really is empty. `../SaidLine.tsx` is what turns that
 * mood into a `role` and an `aria-live`, and the reason it is a value here
 * rather than markup is that the mood is the decision and the markup is not.
 */

import { CSV_CELL, type CsvTable } from "@olai/format"

import type { Said } from "../saying.ts"

export const clampSaid = (table: CsvTable): Said | null => {
  // A FILE WITH NOTHING IN IT is said rather than drawn as an empty table: a
  // bordered rectangle with no rows reads as a page that failed to load, and a
  // file somebody exported empty is a real thing to find out.
  if (table.rows.length === 0) {
    return { tone: "aside", text: "Nothing in it — the file has no rows." }
  }
  // Each clause only when that axis really ran out: a file with nine hundred
  // rows and four columns is owed no word about its columns, and being told
  // about them anyway teaches a reader to skip the line that matters.
  const drawn: Array<string> = []
  if (table.moreRows) drawn.push(`the first ${grouped(table.rows.length)} rows`)
  if (table.moreColumns) drawn.push(`the first ${grouped(table.columns)} columns`)
  const said: Array<string> = []
  if (drawn.length > 0) said.push(`Showing ${drawn.join(", and ")}.`)
  // THE CELL IS ITS OWN SENTENCE rather than a third clause, because it is a
  // different kind of fact: the other two say which part of the file is on
  // screen, and this one says that what IS on screen has been shortened.
  if (table.longCells) {
    said.push(`Long cells are cut at ${grouped(CSV_CELL)} characters.`)
  }
  return said.length === 0 ? null : { tone: "aside", text: said.join(" ") }
}

/**
 * A count with thousands separated — `2,000`.
 *
 * A fact about reading a number off a screen rather than a locale: four digits
 * in a row is a number a reader has to count. `Intl` per render for a thousands
 * separator would be a dependency on the reader's machine for one character,
 * and these counts are rows in a file rather than money.
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
