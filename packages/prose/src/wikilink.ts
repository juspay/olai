/**
 * A WIKILINK AS A VALUE, how one is written, and where one is OPEN.
 *
 * `./obsidian.ts` reads `[[…]]` inside the parser; what it reads travels as
 * {@link WikilinkName} — the target and its `#` parts, kept apart — and is
 * never joined into a string to be split again. The one place a wikilink is
 * WRITTEN is {@link wikilinkWritten}: a dead link's report, a completion's
 * insert and a suggestion all spell it here.
 *
 * {@link wikilinkOpenAt} is the other half of the row editor's `[[` list, and
 * it is no reader of finished text: it is asked of text somebody is still
 * typing, where the link has no `]]` yet. The grammar of an open link is this
 * file's all the same, so the widget holds no second rule about brackets.
 *
 * Parser-free on purpose: the browser asks {@link mayHoldWikilink} and the
 * two above at first paint, before the parser has loaded.
 */

/** What a wikilink looks up: the target, and each `#` part after it in order.
 *  An empty target is a heading of the writing document itself. */
export interface WikilinkName {
  readonly target: string
  readonly fragments: ReadonlyArray<string>
}

/** How a wikilink is written: `[[target#part]]`, with `!` for an embed and
 *  `|words` for an alias. */
export const wikilinkWritten = (
  name: WikilinkName,
  how: { readonly embed?: boolean; readonly alias?: string | null } = {},
): string =>
  `${how.embed === true ? "!" : ""}[[${[name.target, ...name.fragments].join("#")}${
    how.alias === undefined || how.alias === null ? "" : `|${how.alias}`
  }]]`

/** Whether a text may hold a wikilink at all — the cheap negative a reader
 *  asks before anything reads the text. */
export const mayHoldWikilink = (text: string): boolean => text.includes("[[")

/**
 * WHERE A WIKILINK IS OPEN at the caret — the `[[` nearest the end of
 * `before`, when the caret is still inside it, with the name typed so far.
 *
 * Three answers, because a widget needs all three: `undefined` for a caret
 * that is not inside a link at all (no `[[`, or one already closed by a `]]`,
 * or ended by a line break), `null` for a caret that IS inside one where
 * nothing can be offered — past the `|` into the alias, past a `#` into a
 * heading, or more than `cap` characters of name — and the span otherwise.
 * The difference matters to the caller: inside an open link no OTHER widget
 * may open, because a `#` typed there is a heading and not a tag.
 *
 * `from` is the index of the `[` that opens it, so `[from, caret)` is the
 * span a chosen name replaces.
 */
export const wikilinkOpenAt = (
  before: string,
  /** How long a name may be before the line is prose with brackets in it. */
  cap: number,
): { readonly from: number; readonly query: string } | null | undefined => {
  const at = before.lastIndexOf("[[")
  if (at === -1) return undefined
  const query = before.slice(at + 2)
  if (query.includes("]]") || query.includes("\n")) return undefined
  return query.length <= cap && !/[|#\]]/.test(query) ? { from: at, query } : null
}
