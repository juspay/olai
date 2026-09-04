/**
 * A note, as one plain-text line for the title-row snippet.
 *
 * Wherever a `desc` rides a closed row — a tree node, a day entry — it shows
 * as one dim clamped line under the title (Workflowy-style), not open
 * markdown. Full markdown is a document of its own, and drawing every note
 * open is what used to leave only a few nodes on a screen.
 *
 * THE TOP of the note, which is what makes ./excerpt.ts a sibling rather than
 * a caller: that one takes the same clamped line from around a QUERY's hit,
 * for a row a filter found behind its ¶, and it keeps the marks this one drops
 * because it is about a POSITION and this one is about an opening.
 *
 * PLAIN TEXT, not rendered markdown: this sits inside a line beside a title,
 * and a list, a heading or a fenced block drawn there would be a note
 * pretending to be a row. The first non-blank line is taken and its common
 * marks are dropped — `**walnut**` is a note that mentions walnut, and the
 * asterisks are markup rather than the word. Same visual grammar as a
 * document's one-line preview (`@olai/format`'s `firstLine`): one dim truncated
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

/**
 * Where in the NOTE a caret measured against the clamped line goes.
 *
 * The clamp is the note's first non-blank line after `stripMarks`, and the
 * marks are the only characters the line gives up — every character a finger
 * pointed at names one character of the source, so the map is one walk: skip
 * the source's marks until the pointed character has been matched away, and
 * the position it matched is the caret's.
 *
 * The walk cannot wander: the view is a removed-marks copy of the line, so
 * every character of it DOES match, in order, and a click at the line's end
 * lands at the end of the source of that line, before any marks the line
 * closed with.
 *
 * Pure of the DOM, following `./` the way the part anybody would get wrong —
 * the marks, the leading list marker, a first line that is not the first
 * line — is a unit test.
 */
export const measuredAt = (desc: string, at: number): number => {
  let start = 0
  while (start < desc.length) {
    const end = desc.indexOf("\n", start)
    const raw = end === -1 ? desc.slice(start) : desc.slice(start, end)
    const line = raw.trim()
    if (line === "") {
      if (end === -1) return 0
      start = end + 1
      continue
    }
    const view = stripMarks(line)
    // The raw's leading space is off the view's left edge: the walk starts
    // where the trimmed line does.
    const base = start + (raw.length - raw.trimStart().length)
    if (view.length === 0) return base
    let s = base
    // Past whatever marks the first letter was wrapped in, to the letter.
    while (s < desc.length && desc[s] !== view[0]) s++
    let i = 0
    // Caret `at` in the view names the source position of the view's `at`th
    // character: the caret around a marked word is answered just past the
    // marks the word closes with, which is where the space was drawn.
    const last = Math.min(at, view.length)
    while (i < last) {
      s++
      i++
      // Look for the NEXT letter only when the view still has one: a click
      // beyond the drawn words answers the end of the line, not the end of
      // the note.
      if (i < view.length) {
        while (s < desc.length && desc[s] !== view[i]) s++
      }
    }
    return Math.min(s, desc.length)
  }
  return 0
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
  // Closing ATX hashes, counted off the end rather than `replace(/\s+#+$/, "")`
  // — the same linear spelling slug.ts chose. The regex is quadratic: an
  // unanchored `\s+` restarts at every position of a line of spaces.
  // Space and tab only, on purpose: CommonMark's closer, and headingText's two
  // characters. The old `\s` also took NBSP (and U+2000, U+FEFF, \f, \v).
  let end = text.length
  while (end > 0 && text[end - 1] === "#") end--
  if (end < text.length) {
    let before = end
    while (before > 0 && (text[before - 1] === " " || text[before - 1] === "\t")) before--
    if (before < end) text = text.slice(0, before)
  }
  return text.trim()
}
