/**
 * WHAT A `.csv` SAYS — the file read as the rows it is, up to the bound a page
 * can draw, and never past it.
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
 * needs a rectangle), so {@link csvTable} is what pads.
 *
 * ## THE BOUND IS ON THE WORK, not on a slice taken afterwards
 *
 * This is the decision this module was corrected on, and it is worth the
 * paragraph. The bound used to be a `.slice()`: the whole file was scanned,
 * every field of every row allocated, and then the first five hundred rows were
 * handed over. A page that said "showing the first 500" had already paid for
 * all twelve thousand — and a million-row export, or one field holding two
 * hundred megabytes, took the tab down with a clamp on screen saying everything
 * was fine.
 *
 * So the scan STOPS. Three bounds, one per axis a `.csv` can be enormous along:
 *
 *   - ROWS. Once {@link CSV_ROWS} rows are complete, the scan runs on only far
 *     enough to answer one question — is there another row? — and stops at the
 *     first character that says yes. Nothing after it is read.
 *   - COLUMNS. Past {@link CSV_COLUMNS} fields, a row's remaining fields are
 *     CONSUMED and not kept: the quoting still has to be tracked to find where
 *     the row ends, and that costs a walk of characters rather than an array of
 *     strings.
 *   - CELL. A field stops accumulating at {@link CSV_CELL} characters. It is
 *     the axis the other two cannot cover, and the reason is exact: a file that
 *     is one quoted field is ONE row and ONE column, so both other bounds are
 *     silent while the whole file lands in a single `<td>`.
 *
 * ## What a stopped scan can no longer say, and what it says instead
 *
 * "The first 500 of 12,431 rows" is gone, and its going is the point rather
 * than a regression: 12,431 is a number only a full scan knows, and paying for
 * the whole file to print a total the bound exists to avoid reading is the
 * defect wearing an honest sentence. What a stopped scan knows is that there
 * WAS more — {@link CsvTable.moreRows} and its two siblings — so the page says
 * "the first 500 rows", which is true, cheap, and the same warning.
 *
 * The three flags are also what makes the stopping TESTABLE. A file whose tail
 * would change the answer — a five-thousand-column row at line 600 — leaves
 * `moreColumns` false, because the scan never reached it. That is a property no
 * timing test can state and this one can (./csv.test.ts).
 */

/** How much of a `.csv` a page draws before it starts saying what it left out —
 *  and, since the correction above, how much of one is READ at all.
 *
 *  Numbers rather than a size in bytes, because what a reader is looking at is
 *  rows and columns and what a browser struggles with is CELLS. Five hundred
 *  rows is more than anyone reads on a page and few enough that a table of them
 *  lays out in one frame; a hundred columns is past the width of any screen and
 *  is there to bound the export whose header is a thousand fields wide; two
 *  thousand characters is past what anybody reads in a table cell and is there
 *  to bound the field somebody pasted a document into. */
export const CSV_ROWS = 500
export const CSV_COLUMNS = 100
export const CSV_CELL = 2_000

/** What one bounded scan found: the rows it kept, and whether each axis ran
 *  out. Ragged — {@link csvTable} is what squares it off. */
interface Scan {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  readonly moreRows: boolean
  readonly moreColumns: boolean
  readonly longCells: boolean
}

/** The three numbers a scan is bounded by, all of them present — the defaults
 *  applied once, at the door, so nothing below has to ask twice. */
interface Bounds {
  readonly rows: number
  readonly columns: number
  readonly cell: number
}

const boundedBy = (asked?: Partial<Bounds>): Bounds => ({
  rows: asked?.rows ?? CSV_ROWS,
  columns: asked?.columns ?? CSV_COLUMNS,
  cell: asked?.cell ?? CSV_CELL,
})

/**
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
 * commas (`,,`) IS a row, of three empty fields, because the commas are fields
 * somebody wrote. A file that is empty, or only newlines, has no rows at all —
 * which lets the face say "nothing in it" rather than drawing a table of one
 * blank cell.
 *
 * AND IT STOPS AT THE BOUNDS — see the header, which is where that argument
 * lives. What is subtle enough to say twice: the row bound is answered by
 * looking for ONE more written character rather than by counting what is left,
 * so a file with a million rows past the bound costs the same as a file with
 * one.
 */
const scan = (text: string, bounds: Bounds): Scan => {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let field = ""
  let quoted = false
  /** Whether anything a person WROTE has been seen since the last row ended —
   *  a character, a comma, a quote. Line endings deliberately do not set it,
   *  which is the whole of how a blank line stops being a row. */
  let written = false
  /** Whether this row's fields are still being KEPT. Past the column bound they
   *  are consumed instead: the walk goes on, the arrays do not grow. */
  let keeping = true
  let moreRows = false
  let moreColumns = false
  let longCells = false

  /** One field ended — kept, or COUNTED AS DROPPED.
   *
   *  The flag is set in the else arm and not when the bound is reached, and the
   *  difference is a row that is exactly as wide as the rectangle: reaching the
   *  bound means the next field would be dropped, and only a next field that
   *  really arrives means one was. Setting it a field early made every table
   *  whose widest row is exactly {@link CSV_COLUMNS} claim there was more. */
  const endField = () => {
    if (!keeping) {
      moreColumns = true
      field = ""
      return
    }
    row.push(field)
    if (row.length >= bounds.columns) keeping = false
    field = ""
  }
  const endRow = (): boolean => {
    if (!written) return false
    endField()
    rows.push(row)
    row = []
    written = false
    keeping = true
    return true
  }

  for (let at = 0; at < text.length; at++) {
    const char = text[at] as string
    if (quoted) {
      if (char !== '"') {
        keep(char)
        continue
      }
      // A doubled quote is one quote of content; a single one closes the field.
      if (text[at + 1] === '"') {
        keep('"')
        at++
      } else quoted = false
      continue
    }
    if (char === "\n" || char === "\r") {
      // `\r\n` is one ending, not two.
      if (char === "\r" && text[at + 1] === "\n") at++
      // THE ROW BOUND, answered where a row ends: everything after this is a
      // file this page will not draw, so it is not read either.
      if (endRow() && rows.length >= bounds.rows) {
        moreRows = restStartsARow(text, at + 1)
        return { rows, moreRows, moreColumns, longCells }
      }
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
    keep(char)
  }
  // A file that did not end with a newline still ends its last row — and one
  // that did has nothing written since, so this does nothing.
  endRow()
  return { rows, moreRows, moreColumns, longCells }

  /** One character of a field, kept while this row is still being kept and this
   *  field is still short enough. `moreColumns` is not set here: a dropped
   *  CHARACTER of a kept field is the cell bound, and a dropped FIELD is the
   *  column bound, and saying one when the other happened is a page lying about
   *  which axis ran out. */
  function keep(char: string): void {
    if (!keeping) return
    if (field.length >= bounds.cell) {
      longCells = true
      return
    }
    field += char
  }
}

/**
 * IS THERE ANOTHER ROW after `from` — the one question a stopped scan still has
 * to answer, and the cheapest form of it.
 *
 * Not "how many": that is the number the bound exists to avoid reading for. It
 * walks forward only until the first character a row is made of, which is any
 * character that is not a line ending, since a blank line is not a row. A file
 * ending in a hundred newlines costs a hundred comparisons; a file with a
 * million rows left costs one.
 */
const restStartsARow = (text: string, from: number): boolean => {
  for (let at = from; at < text.length; at++) {
    const char = text[at]
    if (char !== "\n" && char !== "\r") return true
  }
  return false
}

/**
 * The rows of a `.csv`, each as the fields it really holds — bounded, and
 * ragged.
 *
 * {@link csvTable} without the squaring off, for the callers that want what the
 * file SAYS rather than what a table needs: this package's own tests, and any
 * later reader of a `.csv` that is not a page. Bounded on the same three axes
 * and by the same defaults, because an unbounded reading exported beside a
 * bounded one is the defect this module was corrected for, left behind under a
 * second name.
 */
export const csvRows = (
  text: string,
  bounds?: Partial<Bounds>,
): ReadonlyArray<ReadonlyArray<string>> => scan(text, boundedBy(bounds)).rows

/** A `.csv` as a page draws it: a rectangle, and which axes ran out. */
export interface CsvTable {
  /**
   * The rows drawn, squared off to {@link CsvTable.columns} — the first is the
   * HEADER, which is a fact about how a `.csv` is written rather than something
   * this reader detected. Every tool that writes one writes a header, nothing
   * in the file marks it, and a page drawing the first row as a header is the
   * convention said out loud in one place instead of guessed per file.
   */
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  /** How wide the drawn rectangle is — the widest kept row's field count. */
  readonly columns: number
  /** The file holds rows this table does not. How many is deliberately not
   *  known: see the header. */
  readonly moreRows: boolean
  /** Some row of the file is wider than this rectangle. */
  readonly moreColumns: boolean
  /** Some cell of the file is longer than what is in it here. */
  readonly longCells: boolean
}

/**
 * The rows of a `.csv`, squared off — everything the page needs and nothing it
 * has to work out for itself.
 *
 * THE PADDING is here rather than in the drawing for the reason the reading is
 * here at all: a ragged file is a real file, a table is a rectangle, and a page
 * that padded per row would be a second place that decides what a short row
 * means. A short row is padded with EMPTY fields, which is what a missing field
 * is.
 *
 * THE BOUNDS ARE ARGUMENTS with defaults, so the one caller that draws can be
 * tested against small numbers without a five-hundred-row fixture, and so the
 * numbers themselves stay named constants a reader can find ({@link CSV_ROWS}).
 */
export const csvTable = (text: string, bounds?: Partial<Bounds>): CsvTable => {
  const found = scan(text, boundedBy(bounds))
  let columns = 0
  for (const row of found.rows) columns = Math.max(columns, row.length)
  const rows = found.rows.map((row) =>
    row.length === columns
      ? row
      : Array.from({ length: columns }, (_, at) => row[at] ?? "")
  )
  return {
    rows,
    columns,
    moreRows: found.moreRows,
    moreColumns: found.moreColumns,
    longCells: found.longCells,
  }
}
