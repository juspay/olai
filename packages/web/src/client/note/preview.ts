/**
 * A note, as one plain-text line for the title-row snippet.
 *
 * Wherever a `desc` rides a closed row — a tree node, a day entry — the title
 * line carries this snippet after the title text (Things-style), not a second
 * row of markdown. Full markdown is a document of its own, and drawing every
 * note open is what used to leave only a few nodes on a screen.
 *
 * PLAIN TEXT, not rendered markdown: this sits inside a line beside a title,
 * and a list, a heading or a fenced block drawn there would be a note
 * pretending to be a row. The first non-blank line is taken and its common
 * marks are dropped — `**walnut**` is a note that mentions walnut, and the
 * asterisks are markup rather than the word. Same visual grammar as a
 * document's one-line preview (`../document/preview.ts`): one dim truncated
 * line, no block rendering.
 */

export const plainLine = (desc: string): string => {
  // Scanned rather than split: a preview reads the top of a note, and
  // `split("\n")` would allocate every line of one to throw all but the first
  // away — on a page that draws this beside every note-carrying row.
  let at = 0
  while (at < desc.length) {
    const end = desc.indexOf("\n", at)
    const line = (end === -1 ? desc.slice(at) : desc.slice(at, end)).trim()
    if (line !== "") return stripMarks(line)
    if (end === -1) break
    at = end + 1
  }
  return ""
}

/** Drop the marks a first line commonly carries, leaving the words. Not a
 *  second renderer: only the shapes that would otherwise print as source
 *  (`**`, `*`, `` ` ``, links, leading list/heading markers). */
const stripMarks = (line: string): string => {
  let text = line
  // Leading block marks: a heading or a list item is still a line of words.
  text = text.replace(/^#{1,6}\s+/, "")
  text = text.replace(/^([-*+]|\d+[.)])\s+/, "")
  // Images first, so their brackets are not mistaken for links.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  // Emphasis and code, paired. Unmatched marks stay — a lone `*` is a character.
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1")
  text = text.replace(/__([^_]+)__/g, "$1")
  text = text.replace(/\*([^*]+)\*/g, "$1")
  text = text.replace(/_([^_]+)_/g, "$1")
  text = text.replace(/`([^`]+)`/g, "$1")
  text = text.replace(/\s+#+$/, "")
  return text.trim()
}
