/**
 * WHAT A `.csv`'s PAGE IS NOT SHOWING, and why — the one sentence under the
 * table.
 *
 * It is HERE and not in the format, and that is the layering rather than a
 * convenience. `@olai/format`'s `csv.ts` answers in NUMBERS — how many rows
 * were drawn, how many the file holds, the same for columns — because what a
 * `.csv` says is a fact about the file. What a READER is told about it is this
 * client's vocabulary, the way what a reader calls each kind of file is
 * (`../file/kinds.ts`'s `NAMED`, which the format cannot import for the same
 * reason). Nothing else in `@olai/format` writes a sentence for a person; a
 * function that did would be the floor deciding how the roof speaks.
 *
 * ONE SENTENCE FOR THE TWO THINGS a page can be not showing, because a reader
 * asks one question — *where is the rest of my file* — and two lines answering
 * it in two voices is two things to find. `null` is the third answer and the
 * ordinary one: the whole file is on the screen, so there is nothing to say and
 * nothing is drawn.
 *
 * AN ASIDE, never an alarm. Nothing was refused and nothing failed: a bound was
 * reached, or the file really is empty. `../SaidLine.tsx` is what turns that
 * mood into a `role` and an `aria-live`, and the reason it is a value here
 * rather than markup is that the mood is the decision and the markup is not.
 */

import type { CsvTable } from "@olai/format"

import type { Said } from "../saying.ts"

export const clampSaid = (table: CsvTable): Said | null => {
  // A FILE WITH NOTHING IN IT is said rather than drawn as an empty table: a
  // bordered rectangle with no rows reads as a page that failed to load, and a
  // file somebody exported empty is a real thing to find out.
  if (table.totalRows === 0) {
    return { tone: "aside", text: "Nothing in it — the file has no rows." }
  }
  const rows = table.rows.length < table.totalRows
    ? `the first ${grouped(table.rows.length)} of ${grouped(table.totalRows)} rows`
    : null
  const columns = table.columns < table.totalColumns
    ? `the first ${grouped(table.columns)} of ${grouped(table.totalColumns)} columns`
    : null
  if (rows === null && columns === null) return null
  // Each clause only when that axis was really clamped: a file with nine
  // hundred rows and four columns is owed no word about its columns, and being
  // told about them anyway teaches a reader to skip the line that matters.
  const both = [rows, columns].filter((clause) => clause !== null).join(", and ")
  return { tone: "aside", text: `Showing ${both}.` }
}

/**
 * A count with thousands separated — `12,431`.
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
