/**
 * WHAT ONE LINE IS, on its own — the classification every later stage reads,
 * and the whole of the reading that needs no context.
 *
 * This is deliberately CONTEXT-FREE: a line is classified by its own shape, and
 * nothing here knows whether a transaction is open or a comment block is
 * running. That is {@link ./group.ts}'s fold, the one stateful thing in the
 * reading, and keeping the two apart is what makes classification something a
 * test can hand a single line.
 *
 * THE ORDER IS THE OLD SCAN'S, and it is the order that matters: a date in a
 * comment is a comment, because the comment check comes first; a date-shaped
 * line whose day is not real is `headerRefused` rather than a transaction,
 * because {@link headerOf} is asked before the line is believed.
 */
import { DATE_SHAPE } from "./date.ts"
import { type Header, headerOf } from "./header.ts"

/** One line, as its own shape — with its raw text, because the fold keeps some
 *  of these verbatim and clips none of them (the bound is later, on finished
 *  records). */
export type Line =
  | { readonly kind: "blank"; readonly raw: string }
  | { readonly kind: "comment"; readonly raw: string }
  | { readonly kind: "blockOpen"; readonly raw: string }
  | { readonly kind: "header"; readonly header: Header; readonly raw: string }
  | { readonly kind: "headerRefused"; readonly raw: string }
  | { readonly kind: "indentedComment"; readonly raw: string }
  | { readonly kind: "indented"; readonly raw: string }
  | { readonly kind: "directive"; readonly raw: string }

/** A line's shape, told from the line alone. A date-shaped line is a header
 *  only when its day exists; otherwise it is refused, and the caller keeps it
 *  as the text it is. */
export const classify = (raw: string): Line => {
  if (/^\s*$/.test(raw)) return { kind: "blank", raw }
  // `;`, `#` and `*` at column zero are a comment, whatever follows them —
  // which is why a date inside one is a comment and not a transaction.
  if (raw.startsWith(";") || raw.startsWith("#") || raw.startsWith("*")) return { kind: "comment", raw }
  if (!/^\s/.test(raw)) {
    if (DATE_SHAPE.test(raw)) {
      const header = headerOf(raw)
      return header === null ? { kind: "headerRefused", raw } : { kind: "header", header, raw }
    }
    if (/^\s*comment\b/.test(raw)) return { kind: "blockOpen", raw }
    return { kind: "directive", raw }
  }
  const content = raw.trim()
  if (content.startsWith(";") || content.startsWith("#")) return { kind: "indentedComment", raw }
  return { kind: "indented", raw }
}
