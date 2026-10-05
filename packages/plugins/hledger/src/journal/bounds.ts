/**
 * HOW MUCH OF A JOURNAL IS READ, and the cut that keeps one field from being
 * the whole page.
 *
 * THE BOUND IS ON THE READING, not a slice taken afterwards, over the three
 * axes a journal can be enormous along: lines read ({@link HLEDGER_LINES}),
 * transactions kept ({@link HLEDGER_TRANSACTIONS}), and the length of any one
 * field ({@link HLEDGER_CELL}). The scan STOPS paying for what it will not
 * draw.
 *
 * THE CELL CUT IS NOT THREADED THROUGH THE PARSE, and it is not a walk over a
 * finished journal either: it is one function ({@link clip}) called where a
 * record is BUILT ({@link ./read.ts}), so a field is cut once, from one
 * constant, and the account a movement is summed under is the same string the
 * page draws. Nine `cut` witnesses passed down through the parse was nine places
 * a record could be forgotten; a walk over the finished value was a second
 * traversal that had to remember every map KEY as well as every field.
 */
/** How many lines of a journal are read at all — past this the file is a file,
 *  not a page. Ten thousand transactions fit in twenty thousand lines with
 *  their postings; a journal past it is a data dump somebody is not reading in
 *  a sidebar. */
export const HLEDGER_LINES = 20_000

/** How many transactions a page draws before it starts saying what it left
 *  out — and, since the bound is on the reading, how many it keeps. */
export const HLEDGER_TRANSACTIONS = 1_000

/** How long any one field may be before it is cut: a description, a comment, an
 *  account, a tag, or a raw line. The axis the other two cannot cover, since a
 *  file that is one enormous line is one line and one transaction. */
export const HLEDGER_CELL = 2_000

/** The numbers a read is bounded by, all present once the door has applied its
 *  defaults. */
export interface Bounds {
  readonly lines: number
  readonly transactions: number
  readonly cell: number
}

/** The bounds a read is under, with the named ones where none was asked for. */
export const boundedBy = (asked?: Partial<Bounds>): Bounds => ({
  lines: asked?.lines ?? HLEDGER_LINES,
  transactions: asked?.transactions ?? HLEDGER_TRANSACTIONS,
  cell: asked?.cell ?? HLEDGER_CELL,
})

/** Whether a read cut anything — the witness one clip shares with its caller,
 *  so that "some field was shortened" is one flag rather than a pair per field. */
export interface Cut {
  cut: boolean
}

/** A field's text, cut at the bound — remembering that it WAS cut, because a
 *  page that says nothing about a shortened description is a page lying about
 *  the file. */
export const clip = (text: string, at: number, witness: Cut): string => {
  if (text.length <= at) return text
  witness.cut = true
  return text.slice(0, at)
}
