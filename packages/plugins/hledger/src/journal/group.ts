import { type Header } from "./header.ts"
import { type Line } from "./line.ts"
import { type Stated, postingOf } from "./posting.ts"
import { type Tag, tagsIn } from "./tags.ts"

export type EntryKind = "directive" | "comment" | "unknown"

export type Block =
  | {
      readonly kind: "entry"
      readonly line: number
      readonly span: number
      readonly text: string
      readonly entry: EntryKind
    }
  | {
      readonly kind: "transaction"
      readonly line: number
      readonly header: Header
      readonly postings: ReadonlyArray<Stated>
      readonly refused: ReadonlyArray<{ readonly line: number; readonly text: string }>
    }

const joined = (held: string | null, addition: string): string =>
  held === null ? addition : `${held}\n${addition}`

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

    if (inComment) {
      blocks.push({ kind: "entry", line: number, span: 1, text: raw, entry: "comment" })
      if (/^\s*end comment\b/.test(raw)) inComment = false
      continue
    }

    switch (line.kind) {
      case "blank":
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
