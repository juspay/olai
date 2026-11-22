/**
 * WHAT A LINE'S WIKILINKS SHOW, read off raw text — the half of
 * `./preview.ts` that turns `[[kitchen-sink#Tables|the table]]` into
 * `the table` for the line drawn under a row before the parser has loaded.
 *
 * ONE LINE, because that is all the preview ever hands it: the first non-blank
 * line of a note, trimmed. There is no block context to keep — a line on its
 * own is never inside a fence — so the only code this knows about is an inline
 * span, which the mask below blanks.
 *
 * What is BETWEEN the brackets is not read here: `./wikilink.ts`'s
 * `readWikilink` is the one reader of that, shared with the parser's construct
 * (`./obsidian.ts`). This file holds only where a line's brackets are.
 *
 * It is a SHORTCUT, held to the parse: `./preview.test.ts` reads every fixture
 * note and docs page both ways. Everything that reads finished text reads
 * wikilinks out of the parse instead.
 */
import { mayHoldWikilink, readWikilink } from "./wikilink.ts"

const OPEN = 0x5b
const CLOSE = 0x5d
const BACKSLASH = 0x5c
const BANG = 0x21

/**
 * INLINE CODE, blanked to spaces so the bracket scan below never sees inside a
 * backtick span — the parse reads `` `[[a]]` `` as the characters it is, and
 * the drawn line shows them, so the shortcut must leave them alone too. This
 * is the ONE thing besides the brackets this file knows, and the equality test
 * needs it: a docs page writes a wikilink inside a code span to show its form.
 *
 * LENGTH-PRESERVING: every character keeps its offset, so the scan can report
 * where in the WRITTEN line a link sits.
 */
const withoutCodeSpans = (line: string): string => {
  let prose = ""
  for (let i = 0; i < line.length;) {
    if (line[i] === "\\") { prose += line.slice(i, i + 2); i += 2; continue }
    if (line[i] !== "`") { prose += line[i++]; continue }
    let end = i
    while (line[end] === "`") end++
    const marker = line.slice(i, end)
    let close = line.indexOf(marker, end)
    while (close !== -1 && (line[close - 1] === "`" || line[close + marker.length] === "`")) close = line.indexOf(marker, close + marker.length)
    if (close === -1) { prose += marker; i = end }
    else { prose += " ".repeat(close + marker.length - i); i = close + marker.length }
  }
  return prose
}

/**
 * The line with each wikilink as the words it shows — `[[kitchen-sink#Tables|the
 * table]]` is `the table` — which is what the page draws in its place.
 *
 * ONE FORWARD SCAN, linear in the line, because this reads text nobody here
 * wrote. A link opens at the last `[[` before its `]]`, holds no `[` and no
 * unescaped `]` of its own, is not opened by an escaped `[`, and is an embed
 * when an unescaped `!` stands before it — the construct's rules, spelled for
 * one line.
 */
export const wikilinksShown = (line: string): string => {
  if (!mayHoldWikilink(line)) return line
  const mask = withoutCodeSpans(line)
  let out = ""
  let last = 0
  let open = -1
  // How many backslashes stand immediately before `at` — an odd run escapes.
  let slashes = 0
  for (let at = 0; at < mask.length; at++) {
    const char = mask.charCodeAt(at)
    const escaped = slashes % 2 === 1
    slashes = char === BACKSLASH ? slashes + 1 : 0
    if (char === OPEN) {
      if (escaped || mask.charCodeAt(at + 1) !== OPEN) { open = -1; continue }
      // A run of `[` opens at its last pair.
      while (mask.charCodeAt(at + 2) === OPEN) at++
      open = at
      at++
    } else if (char === CLOSE) {
      if (open !== -1 && !escaped && mask.charCodeAt(at + 1) === CLOSE) {
        const embed = open > 0 && line.charCodeAt(open - 1) === BANG && !escapedAt(line, open - 1)
        const read = readWikilink(line.slice(open + 2, at), embed)
        if (read !== null) {
          out += line.slice(last, embed ? open - 1 : open) + read.shown
          last = at + 2
        }
        at++
      }
      open = -1
    }
  }
  return last === 0 ? line : out + line.slice(last)
}

/** Whether the character at `at` is escaped: an odd run of backslashes
 *  stands right before it. */
const escapedAt = (line: string, at: number): boolean => {
  let slashes = 0
  while (at - slashes - 1 >= 0 && line.charCodeAt(at - slashes - 1) === BACKSLASH) slashes++
  return slashes % 2 === 1
}
