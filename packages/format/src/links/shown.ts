/**
 * WHAT A WIKILINK SHOWS, read off raw text — the browser's preview line under
 * a row reads a note's first line before the parser has loaded, and this is
 * how it turns `[[kitchen-sink#Tables|the table]]` into `the table` there.
 * Everything else reads wikilinks out of the parse (`@olai/prose`'s
 * `obsidian.ts`).
 */

/**
 * BLOCK CONTEXT, LOCALLY — the lines that are a fenced or indented code block,
 * blanked to spaces so the wikilink scan below never sees inside one.
 *
 * LENGTH-PRESERVING: every character keeps its offset, so the scan that reads
 * this mask can report where in the WRITTEN text a link sits.
 *
 * List continuation indentation belongs to prose; four further spaces
 * introduce code within that item. Blank lines retain the list context.
 * Block context is local to this Markdown source, never shared across fields.
 */
const withoutCodeBlocks = (text: string): string => {
  let listIndent: number | undefined
  let fence: { marker: string; length: number } | undefined
  return text.split("\n").map(line => {
    // List continuation indentation belongs to prose; four further spaces
    // introduce code within that item. Blank lines retain the list context.
    const indent = /^( *)/.exec(line)![1]!.length
    // Literal fence contents cannot change the list context of its closer.
    if (fence === undefined) {
      const item = /^( *)(?:[-+*]|\d+[.)]) +/.exec(line)
      if (item && indent < (listIndent ?? 0) + 4) listIndent = item[0].length
      else if (line.trim() !== "" && listIndent !== undefined && indent < listIndent) listIndent = undefined
    }
    const content = listIndent === undefined ? line : line.slice(Math.min(indent, listIndent))
    const match = /^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})(.*)$/.exec(content)
    if (fence !== undefined) {
      if (match && match[1]![0] === fence.marker && match[1]!.length >= fence.length && match[2]!.trim() === "") fence = undefined
      return " ".repeat(line.length)
    }
    if (match && (match[1]![0] !== "`" || !match[2]!.includes("`"))) {
      fence = { marker: match[1]![0]!, length: match[1]!.length }
      return " ".repeat(line.length)
    }
    return /^( {4}|\t)/.test(content) ? " ".repeat(line.length) : line
  }).join("\n")
}

/**
 * INLINE CODE has its own delimiter rules, independent of block indentation —
 * the mirror half of {@link withoutCodeBlocks}, applied AFTER it so a span
 * split across nothing a fence let through is still removed. Length-preserving
 * for the same reason: a span becomes spaces, and its line breaks stay.
 */
const withoutCodeSpans = (lines: string): string => {
  let prose = ""
  for (let i = 0; i < lines.length;) {
    if (lines[i] === "\\") { prose += lines.slice(i, i + 2); i += 2; continue }
    if (lines[i] !== "`") { prose += lines[i++]; continue }
    let end = i
    while (lines[end] === "`") end++
    const marker = lines.slice(i, end)
    let close = lines.indexOf(marker, end)
    while (close !== -1 && (lines[close - 1] === "`" || lines[close + marker.length] === "`")) close = lines.indexOf(marker, close + marker.length)
    if (close === -1) { prose += marker; i = end }
    else { prose += lines.slice(i, close + marker.length).replace(/[^\n]/g, " "); i = close + marker.length }
  }
  return prose
}

/** The text with its literal code blanked, every character at its offset. */
const proseMask = (text: string): string => withoutCodeSpans(withoutCodeBlocks(text))

/**
 * ONE WIKILINK AS WRITTEN — `[[target#heading|alias]]`, or the embed
 * `![[target]]` — with where it sits in the text it was read from.
 *
 * What it NAMES is {@link Wikilink.name}: the target and its headings, never
 * the alias. Which file that is depends on what the directory holds, so it is
 * answered by `./wikilink.ts` whenever it is asked, never here.
 */
export interface Wikilink {
  /** Offset of the link's first character (the `!` of an embed). */
  readonly start: number
  /** Offset just after its closing `]]`. */
  readonly end: number
  readonly embed: boolean
  /** The text before any `#` and `|`, trimmed. Empty for `[[#Heading]]`. */
  readonly target: string
  /** Each `#` part after the target, trimmed, in order; the last is the one
   *  it lands on. A part opening with `^` is a block reference. */
  readonly fragments: ReadonlyArray<string>
  /** The words after the `|`, trimmed; `null` when there are none. */
  readonly alias: string | null
  /** What the link draws: the alias, or the target and headings joined
   *  by ` > `. */
  readonly shown: string
  /** The target and its fragments, `#`-joined — what is looked up. */
  readonly name: string
}

const NO_WIKILINKS: ReadonlyArray<Wikilink> = []

const OPEN = 0x5b
const CLOSE = 0x5d
const NEWLINE = 0x0a
const BACKSLASH = 0x5c
const BANG = 0x21

/**
 * EVERY WIKILINK IN A PIECE OF PROSE, in the order it writes them — the
 * literal code removed first by the mask above, so a `[[…]]` in a code span or
 * block is text here exactly as it is on the page.
 *
 * ONE FORWARD SCAN, linear in the text, because this reads text nobody here
 * wrote. A link opens at the last `[[` before its `]]`, stays on one line,
 * holds no lone bracket, and is not opened by an escaped `[`.
 */
export const wikilinksIn = (text: string): ReadonlyArray<Wikilink> =>
  text.includes("[[") ? wikilinkScan(text, proseMask(text)) : NO_WIKILINKS

/**
 * The text with each wikilink as the words it shows — `[[kitchen-sink#Tables|the
 * table]]` is `the table` — which is what the page draws in its place.
 */
export const wikilinksShown = (text: string): string => {
  const links = wikilinksIn(text)
  if (links.length === 0) return text
  let out = ""
  let last = 0
  for (const link of links) {
    out += text.slice(last, link.start) + link.shown
    last = link.end
  }
  return out + text.slice(last)
}

const wikilinkScan = (text: string, mask: string): ReadonlyArray<Wikilink> => {
  let found: Array<Wikilink> | undefined
  let open = -1
  // How many backslashes stand immediately before `at` — an odd run escapes.
  let slashes = 0
  for (let at = 0; at < mask.length; at++) {
    const char = mask.charCodeAt(at)
    const escaped = slashes % 2 === 1
    slashes = char === BACKSLASH ? slashes + 1 : 0
    if (char === NEWLINE) open = -1
    else if (char === OPEN) {
      if (escaped || mask.charCodeAt(at + 1) !== OPEN) { open = -1; continue }
      // A run of `[` opens at its last pair.
      while (mask.charCodeAt(at + 2) === OPEN) at++
      open = at
      at++
    } else if (char === CLOSE) {
      if (open !== -1 && !escaped && mask.charCodeAt(at + 1) === CLOSE) {
        const link = wikilinkAt(text, open, at)
        if (link !== null) (found ??= []).push(link)
        at++
      }
      open = -1
    }
  }
  return found ?? NO_WIKILINKS
}

/** The link whose `[[` is at `open` and whose `]]` is at `close`, or `null`
 *  for brackets that name nothing. */
const wikilinkAt = (text: string, open: number, close: number): Wikilink | null => {
  // `\|` is the bar a table cell needs written escaped; inside a link it is
  // the alias bar either way.
  const inner = text.slice(open + 2, close).replaceAll("\\|", "|")
  const bar = inner.indexOf("|")
  const named = bar === -1 ? inner : inner.slice(0, bar)
  const words = bar === -1 ? "" : inner.slice(bar + 1).trim()
  const parts = named.split("#")
  const target = (parts[0] as string).trim()
  const fragments = parts.slice(1).map(part => part.trim()).filter(part => part !== "")
  if (target === "" && fragments.length === 0) return null
  const embed = open > 0 && text.charCodeAt(open - 1) === BANG && !escapedAt(text, open - 1)
  const alias = words === "" ? null : words
  return {
    start: embed ? open - 1 : open,
    end: close + 2,
    embed,
    target,
    fragments,
    alias,
    shown: alias ?? (target === "" ? fragments : [target, ...fragments]).join(" > "),
    name: [target, ...fragments].join("#"),
  }
}

/** Whether the character at `at` is escaped: an odd run of backslashes
 *  stands right before it. */
const escapedAt = (text: string, at: number): boolean => {
  let slashes = 0
  while (at - slashes - 1 >= 0 && text.charCodeAt(at - slashes - 1) === BACKSLASH) slashes++
  return slashes % 2 === 1
}
