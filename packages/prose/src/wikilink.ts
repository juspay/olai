/**
 * A WIKILINK AS A VALUE, and how one is written.
 *
 * `./obsidian.ts` reads `[[…]]` inside the parser; what it reads travels as
 * {@link WikilinkName} — the target and its `#` parts, kept apart — and is
 * never joined into a string to be split again. The one place a wikilink is
 * WRITTEN is {@link wikilinkWritten}: a dead link's report, a completion's
 * insert and a suggestion all spell it here.
 *
 * Parser-free on purpose: the browser asks {@link mayHoldWikilink} at first
 * paint, before the parser has loaded.
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
