/**
 * WHAT A `.csv` SAYS — the file read as the rows it is, and the honest
 * sentence about the ones that were not read.
 *
 * A `.csv` is one of the kinds olai claims (./kinds.ts), and the whole of what
 * this app does with one is SHOW it: a header row and the rows under it, drawn
 * as a table, never edited. So the reading is one function and it produces a
 * value, not a component — the page that draws it is `@olai/web`'s business and
 * this is the format's, for the reason every other reading in this package is
 * here: what a served file MEANS is one answer, and a second parser in the
 * browser would be a second answer nothing holds to the first.
 *
 * ## It is a reader and not a parser of the standard
 *
 * RFC 4180's grammar is the one implemented, because it is the one every tool
 * that writes a `.csv` writes: fields separated by commas, a field that holds a
 * comma, a quote or a newline wrapped in `"`, and a `"` inside such a field
 * written twice. What is deliberately NOT here is dialect detection — a
 * semicolon separator, a tab, a declared `sep=`, an encoding that is not UTF-8.
 * Every one of those is a guess about somebody's file, and a guess drawn as a
 * table is a table that is confidently wrong; a file this reader gets wrong
 * looks wrong, which is the failure a person can see and fix.
 *
 * A RAGGED file is not an error either, and that is the second decision. Rows
 * with different field counts are common in the wild — a trailing comma, a
 * comment line, a file two tools appended to — and the reader hands each row
 * back as long as it really is. What squares them off is the DRAWING (a table
 * needs a rectangle), so {@link csvTable} is what pads, and it says how wide
 * the widest row was so nothing is silently dropped off the right-hand edge.
 *
 * ## The bound is the point of the second function
 *
 * A vault can hold a million-row export. The page is a page — a reader opens it
 * to see what is in the file, not to scroll a database — so {@link csvTable}
 * takes a bound and answers with what it drew AND what was there. That is this
 * repository's never-silently rule applied to a shape rather than to an error:
 * a table showing the first five hundred rows of twelve thousand with nothing
 * saying so is a lie the reader cannot see.
 *
 * WHAT THIS DOES NOT DO IS SAY IT, and the absence is a layering rather than a
 * gap. This answers in NUMBERS, because how many rows a file holds is a fact
 * about the file; the SENTENCE a reader is told is the client's vocabulary
 * (`@olai/web`'s `document/clamped.ts`), the way what a reader calls each kind
 * of file is. Nothing else in this package writes a sentence for a person, and
 * a function that did would be the floor deciding how the roof speaks.
 */

/**
 * The rows of a `.csv`, each as the fields it really holds.
 *
 * ONE FORWARD SCAN over the text, character by character, with the quote state
 * carried — not a `split("\n")` followed by a `split(",")`, which is the
 * implementation everybody writes first and which cuts a field holding a
 * newline in half. A quoted field is exactly the field that may hold the two
 * characters the naive version separates on, so the separators cannot be found
 * before the quoting is read.
 *
 * LINE ENDINGS are `\n`, `\r\n` and a lone `\r`, all three, because a file
 * written on another machine is the ordinary case rather than the exotic one. A
 * `\r\n` inside a quoted field survives as itself: it is content there, and
 * normalising it would be this reader editing somebody's data on the way past.
 *
 * A BLANK LINE IS NOT A ROW, which covers the trailing newline every writer
 * ends a file with, the extra one an editor left, and the gap between two files
 * somebody concatenated. It is a forgiving reading and it is the only one that
 * does not put an empty stripe in the middle of somebody's table; a line of
 * commas (`,,`) IS a row, of three empty fields, because the commas are
 * fields somebody wrote. A file that is empty, or only newlines, has no rows at
 * all — which lets the face say "nothing in it" rather than drawing a table of
 * one blank cell.
 */
export const csvRows = (text: string): ReadonlyArray<ReadonlyArray<string>> => {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ""
  let quoted = false
  /** Whether anything a person WROTE has been seen since the last row ended —
   *  a character, a comma, a quote. Line endings deliberately do not set it,
   *  which is the whole of how a blank line stops being a row. */
  let written = false

  const endField = () => {
    row.push(field)
    field = ""
  }
  const endRow = () => {
    if (!written) return
    endField()
    rows.push(row)
    row = []
    written = false
  }

  for (let at = 0; at < text.length; at++) {
    const char = text[at] as string
    if (quoted) {
      if (char !== '"') {
        field += char
        continue
      }
      // A doubled quote is one quote of content; a single one closes the field.
      if (text[at + 1] === '"') {
        field += '"'
        at++
      } else quoted = false
      continue
    }
    if (char === "\n") {
      endRow()
      continue
    }
    if (char === "\r") {
      // `\r\n` is one ending, not two.
      if (text[at + 1] === "\n") at++
      endRow()
      continue
    }
    written = true
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ",") {
      endField()
      continue
    }
    field += char
  }
  // A file that did not end with a newline still ends its last row — and one
  // that did has nothing written since, so this does nothing.
  endRow()
  return rows
}

/** How much of a `.csv` a page draws before it starts saying what it left out.
 *
 *  Numbers rather than a size in bytes, because what a reader is looking at is
 *  rows and columns and what a browser struggles with is CELLS. Five hundred
 *  rows is more than anyone reads on a page and few enough that a table of them
 *  lays out in one frame; a hundred columns is past the width of any screen and
 *  is there to bound the export whose header is a thousand fields wide. */
export const CSV_ROWS = 500
export const CSV_COLUMNS = 100

/** A `.csv` as a page draws it: a rectangle, and what was really there. */
export interface CsvTable {
  /**
   * The rows drawn, squared off to {@link CsvTable.columns} — the first is the
   * HEADER, which is a fact about how a `.csv` is written rather than something
   * this reader detected. Every tool that writes one writes a header, nothing
   * in the file marks it, and a page drawing the first row as a header is the
   * convention said out loud in one place instead of guessed per file.
   */
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  /** How wide the drawn rectangle is — the widest row's field count, bounded. */
  readonly columns: number
  /** How many rows the file really holds, header included. */
  readonly totalRows: number
  /** How wide the widest row of the file really is. */
  readonly totalColumns: number
}

/**
 * The rows of a `.csv`, squared off and bounded — everything the page needs and
 * nothing it has to work out for itself.
 *
 * THE PADDING is here rather than in the drawing for the reason the reading is
 * here at all: a ragged file is a real file, a table is a rectangle, and a page
 * that padded per row would be a second place that decides what a short row
 * means. A short row is padded with EMPTY fields, which is what a missing field
 * is; a long one is cut, and `totalColumns` is what says it was.
 *
 * THE BOUNDS ARE ARGUMENTS with defaults, so the one caller that draws can be
 * tested against small numbers without a five-hundred-row fixture, and so the
 * numbers themselves stay named constants a reader can find ({@link CSV_ROWS}).
 */
export const csvTable = (
  text: string,
  bounds?: { readonly rows?: number; readonly columns?: number },
): CsvTable => {
  const all = csvRows(text)
  const maxRows = bounds?.rows ?? CSV_ROWS
  const maxColumns = bounds?.columns ?? CSV_COLUMNS
  let totalColumns = 0
  for (const row of all) totalColumns = Math.max(totalColumns, row.length)
  const columns = Math.min(totalColumns, maxColumns)
  const rows = all.slice(0, maxRows).map((row) =>
    Array.from({ length: columns }, (_, at) => row[at] ?? "")
  )
  return { rows, columns, totalRows: all.length, totalColumns }
}
