/**
 * A WIKILINK AS A VALUE: what is between its brackets, how one is written,
 * and where one is OPEN.
 *
 * {@link readWikilink} is the ONE reader of what stands between `[[` and
 * `]]`. Both callers that find those brackets ask it: the parser's construct
 * (`./obsidian.ts`) and the preview line's one-line shortcut (`./shown.ts`),
 * so neither can disagree with the other about a link's name or its words.
 * What a link looks up travels as {@link WikilinkName} — the target and its
 * `#` parts, kept apart — and is never joined into a string to be split
 * again. The one place a wikilink is WRITTEN is {@link wikilinkWritten}: a
 * dead link's report, a completion's insert and a suggestion all spell it
 * here.
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

/** What the text between `[[` and `]]` says: the name, the alias, and the
 *  words the link shows. */
export interface WikilinkRead extends WikilinkName {
  /** The words after the `|`, trimmed, or `null` when there are none. */
  readonly alias: string | null
  /** Written `![[…]]`. */
  readonly embed: boolean
  /** What the link draws: the alias, or the target and its fragments joined
   *  by ` > `. */
  readonly shown: string
}

/**
 * WHAT IS BETWEEN THE BRACKETS, or `null` when it names nothing — the one
 * reader of a wikilink's inside, shared by the parser's construct
 * (`./obsidian.ts`) and the preview line's shortcut (`./shown.ts`), so the
 * two cannot disagree about what a link is called or what it shows.
 *
 * `inner` is what stands between `[[` and `]]`, the brackets excluded; the
 * caller has already decided where those are, and says whether a `!` opens it.
 */
export const readWikilink = (inner: string, embed: boolean): WikilinkRead | null => {
  // `\|` is the bar a table cell needs written escaped; inside a link it is
  // the alias bar either way.
  const text = inner.replaceAll("\\|", "|")
  const bar = text.indexOf("|")
  const named = bar === -1 ? text : text.slice(0, bar)
  const words = bar === -1 ? "" : text.slice(bar + 1).trim()
  const parts = named.split("#")
  const target = (parts[0] as string).trim()
  const fragments = parts.slice(1).map((part) => part.trim()).filter((part) => part !== "")
  if (target === "" && fragments.length === 0) return null
  const alias = words === "" ? null : words
  return {
    target,
    fragments,
    alias,
    embed,
    shown: alias ?? (target === "" ? fragments : [target, ...fragments]).join(" > "),
  }
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
