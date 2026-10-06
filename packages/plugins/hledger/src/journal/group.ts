/**
 * THE ONE STATEFUL FOLD — classified lines into blocks, which is the only place
 * the reading remembers anything.
 *
 * Three things need memory, and they are the whole of it:
 *
 *   - a COMMENT BLOCK: `comment` opens it and `end comment` closes it, and
 *     everything between is a comment line whatever it looks like;
 *   - a DIRECTIVE'S SUB-LINES: an indented line under a directive continues
 *     THAT directive, keeping its own text, so a directive's continuation stays
 *     with the directive rather than becoming a line the page calls unknown;
 *   - a TRANSACTION: its postings, and the indented comments that join the
 *     transaction before its first posting or the posting above it.
 *
 * EVERY BLOCK IS BUILT ONCE. A directive's lines accumulate locally and are
 * pushed in one piece when the directive ends, so nothing in the answer is
 * rewritten after it was finished and there is no index to reach back into.
 *
 * A refused posting line is NOT part of the transaction's postings: it is kept
 * with the block, to be drawn as the raw line it is, and its presence is what
 * tells {@link ./infer.ts} the sum has a hole in it.
 */
import { type Header } from "./header.ts"
import { type Line } from "./line.ts"
import { type Stated, postingOf } from "./posting.ts"
import { type Tag, tagsIn } from "./tags.ts"

/** What a kept-as-text line was: the one thing typed about a line that is
 *  neither a transaction nor a posting. */
export type EntryKind = "directive" | "comment" | "unknown"

/** One finished block of the fold: an entry (a directive, a comment, or a line
 *  this reader could not make sense of), or a transaction with its postings and
 *  the lines under it that were refused. */
export type Block =
  | {
      readonly kind: "entry"
      readonly line: number
      /** How many source lines this entry covers — one for a comment, and one
       *  per line for a directive whose sub-lines continue it. The Raw view
       *  marks every one of them, and it cannot count them off the TEXT: the
       *  text is cut at the cell bound and a cut line would lose its mark. */
      readonly span: number
      readonly text: string
      readonly entry: EntryKind
    }
  | {
      readonly kind: "transaction"
      readonly line: number
      /** The header with its FINAL comment and tags: an indented comment under
       *  the header joins them here, so nothing downstream merges two shapes. */
      readonly header: Header
      readonly postings: ReadonlyArray<Stated>
      readonly refused: ReadonlyArray<{ readonly line: number; readonly text: string }>
    }

/** A comment and the line that joined it — indented comment lines under one
 *  posting or one transaction are one comment, because that is what they are. */
const joined = (held: string | null, addition: string): string =>
  held === null ? addition : `${held}\n${addition}`

/** The fold: classified lines, in file order, into blocks. */
export const group = (lines: ReadonlyArray<Line>): ReadonlyArray<Block> => {
  const blocks: Array<Block> = []
  let inComment = false
  let directive: { readonly line: number; readonly lines: Array<string> } | null = null
  let txn: {
    readonly line: number
    header: Header
    readonly postings: Array<Stated>
    readonly refused: Array<{ line: number; text: string }>
  } | null = null

  const flushDirective = (): void => {
    if (directive === null) return
    blocks.push({
      kind: "entry",
      line: directive.line,
      span: directive.lines.length,
      text: directive.lines.join("\n"),
      entry: "directive",
    })
    directive = null
  }
  const flushTxn = (): void => {
    if (txn === null) return
    blocks.push({
      kind: "transaction",
      line: txn.line,
      header: txn.header,
      postings: txn.postings,
      refused: txn.refused,
    })
    txn = null
  }

  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] as Line
    const number = at + 1
    const raw = line.raw

    // INSIDE A COMMENT BLOCK every line is a comment, whatever it looks like —
    // this is the one thing the classification above cannot say on its own.
    if (inComment) {
      blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "comment" })
      if (/^\s*end comment\b/.test(raw)) inComment = false
      continue
    }

    switch (line.kind) {
      case "blank":
        // A blank line ends both a transaction and a directive's sub-lines,
        // and is drawn as nothing at all.
        flushTxn()
        flushDirective()
        continue
      case "comment":
        flushTxn()
        flushDirective()
        blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "comment" })
        continue
      case "blockOpen":
        flushTxn()
        flushDirective()
        inComment = true
        blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "comment" })
        continue
      case "directive":
        flushTxn()
        flushDirective()
        directive = { line: number, lines: [raw] }
        continue
      case "header":
        flushTxn()
        flushDirective()
        // The transaction's comment and tags START as the header's own, and an
        // indented comment below joins them — which is what makes a comment
        // under the header part of the transaction rather than a lost line. The
        // header is REPLACED on each join, because a Header's fields are
        // readonly and there is exactly one shape downstream.
        txn = { line: number, header: line.header, postings: [], refused: [] }
        continue
      case "headerRefused":
        flushTxn()
        flushDirective()
        blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "unknown" })
        continue
      case "indentedComment": {
        const comment = raw.trim().replace(/^[;#]+\s*/, "").trim()
        if (txn !== null) {
          if (txn.postings.length === 0) {
            txn.header = {
              ...txn.header,
              comment: joined(txn.header.comment, comment),
              tags: [...txn.header.tags, ...tagsIn(comment).tags],
            }
          } else {
            const last = txn.postings[txn.postings.length - 1] as Stated
            txn.postings[txn.postings.length - 1] = {
              ...last,
              posting: {
                ...last.posting,
                comment: joined(last.posting.comment, comment),
                tags: [...last.posting.tags, ...tagsIn(comment).tags],
              },
            }
          }
        } else if (directive !== null) {
          directive.lines.push(raw)
        } else {
          blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "comment" })
        }
        continue
      }
      case "indented":
        if (txn !== null) {
          const stated = postingOf(raw)
          if (stated === null) txn.refused.push({ line: number, text: raw })
          else txn.postings.push(stated)
        } else if (directive !== null) {
          directive.lines.push(raw)
        } else {
          blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "unknown" })
        }
        continue
    }
  }
  flushTxn()
  flushDirective()
  return blocks
}
