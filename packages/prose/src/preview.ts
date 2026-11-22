/**
 * A TEXT'S FIRST LINE AS WORDS, without the parser.
 *
 * The line drawn under a closed row — a tree node, a day entry — is one dim
 * clamped line of a note, and it is drawn at first paint, before the parser
 * has loaded (`olai-plugin-outlines`'s `note/preview.ts`). So it is a
 * SHORTCUT, under the rule every shortcut here lives by: `./preview.test.ts`
 * holds it equal to `read(text).firstLine` over every fixture note and every
 * docs page, or it goes.
 *
 * The first non-blank line is taken and its common marks are dropped —
 * `**walnut**` is a note that mentions walnut, and the asterisks are markup
 * rather than the word. Not a second renderer and not a second parser: only
 * the shapes that would otherwise print as source, which is why the test
 * above is what keeps it honest.
 */
import { wikilinksShown } from "./shown.ts"

/** The first line a text draws, as words. */
export const previewLine = (text: string): string => {
  // Scanned rather than split: a preview reads the top of a note, and
  // `split("\n")` would allocate every line of one to throw all but the first
  // away — on a page that draws this beside every note-carrying row.
  let at = 0
  while (at < text.length) {
    const end = text.indexOf("\n", at)
    const line = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    if (line !== "") return withoutMarks(line)
    if (end === -1) break
    at = end + 1
  }
  return ""
}

/** Drop the marks a first line commonly carries, leaving the words. Exported
 *  for the one caller that maps a caret on the drawn line back to the note it
 *  was taken from (`note/preview.ts`'s `measuredAt`), which walks the same
 *  two strings this makes. */
export const withoutMarks = (line: string): string => {
  // A wikilink is the words it shows, as the drawn note shows it.
  let text = wikilinksShown(line)
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
  // Closing ATX hashes, counted off the end rather than `replace(/\s+#+$/, "")`
  // — the same linear spelling ./slug.ts chose. The regex is quadratic: an
  // unanchored `\s+` restarts at every position of a line of spaces.
  // Space and tab only, on purpose: CommonMark's closer, and the two
  // characters a heading's words give up.
  let end = text.length
  while (end > 0 && text[end - 1] === "#") end--
  if (end < text.length) {
    let before = end
    while (before > 0 && (text[before - 1] === " " || text[before - 1] === "\t")) before--
    if (before < end) text = text.slice(0, before)
  }
  return text.trim()
}
