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
 * THE CELL CUT IS APPLIED TO FINISHED RECORDS rather than threaded through the
 * parsing, which is what the record shapes buy: `headerOf`, `postingOf` and the
 * fold all work on the file's own text, and every field is cut once at the end,
 * in one place, from one constant. Nine `cut` witnesses passed down through the
 * parse was nine places a record could be forgotten and nine call sites that had
 * to agree about a counter.
 */
import { type Posting } from "./posting.ts"
import { type Journal } from "./read.ts"
import { type Tag } from "./tags.ts"

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

/** A finished read with every field cut at `at`, and `longCells` set when any
 *  one of them was. One cut, one place, from one constant. */
export const clipFields = (read: Journal, at: number): Journal => {
  let cut = false
  const clip = (text: string): string => {
    if (text.length <= at) return text
    cut = true
    return text.slice(0, at)
  }
  const tags = (ones: ReadonlyArray<Tag>): ReadonlyArray<Tag> =>
    ones.map((one) => ({ key: clip(one.key), value: one.value === null ? null : clip(one.value) }))
  const postings = (ones: ReadonlyArray<Posting>): ReadonlyArray<Posting> =>
    ones.map((one) => ({
      ...one,
      account: clip(one.account),
      comment: one.comment === null ? null : clip(one.comment),
      tags: tags(one.tags),
    }))
  return {
    ...read,
    transactions: read.transactions.map((one) => ({
      ...one,
      code: one.code === null ? null : clip(one.code),
      description: clip(one.description),
      payee: clip(one.payee),
      note: one.note === null ? null : clip(one.note),
      comment: one.comment === null ? null : clip(one.comment),
      tags: tags(one.tags),
      postings: postings(one.postings),
    })),
    entries: read.entries.map((one) => ({ ...one, text: clip(one.text) })),
    longCells: read.longCells || cut,
  }
}
