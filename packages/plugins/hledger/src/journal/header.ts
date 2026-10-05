/**
 * A TRANSACTION'S HEADER — the date, the mark, the code and the two halves of
 * the description — and NOTHING under it.
 *
 * This is context-free: it reads one line and answers whether that line is a
 * header. The postings below it are {@link ./posting.ts}'s, and it is
 * {@link ./group.ts}'s fold that knows there were any. Splitting the header
 * from the body is what makes a header a value a caller can judge before it
 * decides what follows.
 *
 * A date-shaped line whose date names no real day is NOT a header (`null`):
 * a header this reader cannot date is a line it cannot make sense of, and the
 * caller keeps it as raw text.
 */
import { DATE_SHAPE, endsAt, iso } from "./date.ts"
import { type Tag, tagsIn } from "./tags.ts"

/** How a transaction is marked: `*` cleared, `!` pending, or neither. */
export type Status = "cleared" | "pending" | "unmarked"

/** One transaction's header. `date` is the line's own spelling normalized to
 *  `YYYY-MM-DD`; `payee` and `note` are the two halves of a `a | b`
 *  description, and `payee` is the whole description when the file wrote no
 *  `|`. */
export interface Header {
  readonly date: string
  readonly secondaryDate: string | null
  readonly status: Status
  readonly code: string | null
  readonly description: string
  readonly payee: string
  readonly note: string | null
  readonly comment: string | null
  readonly tags: ReadonlyArray<Tag>
}

/** One transaction's header, or `null` when the line is not one. */
export const headerOf = (line: string): Header | null => {
  const dateWritten = DATE_SHAPE.exec(line)?.[0]
  if (dateWritten === undefined) return null
  const date = iso(dateWritten)
  if (date === null) return null
  let rest = line.slice(dateWritten.length)

  let secondaryDate: string | null = null
  if (rest.startsWith("=")) {
    // `=` here is a secondary date and nothing else; a spelling that names no
    // real day makes the whole line unreadable rather than a transaction whose
    // second date quietly went missing.
    const after = rest.slice(1)
    const second = DATE_SHAPE.exec(after)?.[0]
    if (second === undefined || !endsAt(after, second.length)) return null
    const isoSecond = iso(second)
    if (isoSecond === null) return null
    secondaryDate = isoSecond
    rest = after.slice(second.length)
  }
  if (!endsAt(rest, 0) && !rest.startsWith("=")) return null

  rest = rest.trimStart()
  let status: Status = "unmarked"
  if (rest.startsWith("*")) {
    status = "cleared"
    rest = rest.slice(1).trimStart()
  } else if (rest.startsWith("!")) {
    status = "pending"
    rest = rest.slice(1).trimStart()
  }

  let code: string | null = null
  if (rest.startsWith("(")) {
    const close = rest.indexOf(")")
    if (close > 0) {
      code = rest.slice(1, close).trim()
      rest = rest.slice(close + 1).trimStart()
    }
  }

  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  const head = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  const bar = head.indexOf("|")
  return {
    date,
    secondaryDate,
    status,
    code,
    description: head,
    payee: bar >= 0 ? head.slice(0, bar).trim() : head,
    note: bar >= 0 ? head.slice(bar + 1).trim() : null,
    comment: comment === "" ? null : comment,
    tags: comment === null ? [] : tagsIn(comment).tags,
  }
}
