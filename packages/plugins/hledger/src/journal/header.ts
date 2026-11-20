import { DATE_SHAPE, endsAt, iso } from "./date.ts"
import { type Tag, tagsIn } from "./tags.ts"

export type Status = "cleared" | "pending" | "unmarked"

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

export const headerOf = (line: string): Header | null => {
  const dateWritten = DATE_SHAPE.exec(line)?.[0]
  if (dateWritten === undefined) return null
  const date = iso(dateWritten)
  if (date === null) return null
  let rest = line.slice(dateWritten.length)

  let secondaryDate: string | null = null
  if (rest.startsWith("=")) {
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
