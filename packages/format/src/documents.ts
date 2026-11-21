/** Relative links, pictures and the forward references of a record or body.
 * Resolution is beside the writing file and independent of served membership;
 * dead-links.ts asks that separate question against a revision's paths.
 */
import { type Address, addressOf, printAddress } from "./address.ts"
import { proseIn } from "@olai/prose/frontmatter.ts"
import { bodyKind, type Claims } from "./kinds.ts"
import { isMirror, type Located } from "./node.ts"
import { isPicture } from "./serving.ts"
import { recordRead } from "./kept.ts"
import type { Read, ReadWikilink } from "@olai/prose/read.ts"

/**
 * WHAT WAS HERE, and where it went: a `Document` of `{file, text}` — the whole
 * of what the set knew about a `.md` or a `.html`, and the reason no feature
 * could name anything inside one. It is `./document.ts`'s sum now, with a face
 * on every arm, and the set serves that as its one collection; the two lookups
 * that stood beside it (`documentsIn`, `documentIn`, each a `.filter` over the
 * bodied half) are `markdownIn` and `markdownAt` over that collection
 * (`./set.ts`).
 *
 * What stays in this module is WHERE A REFERENCE LANDS, and it is one subject
 * read at three grains: the arithmetic (where a relative `![](…)` and
 * a relative `[…](…)` resolve to), the refusals (what a page may fetch at all),
 * and the two readings built out of those — {@link readAddresses}, every
 * address a text's READING points at, and {@link recordLinks}, every address one RECORD
 * points at.
 *
 * THOSE TWO SIT TOGETHER on purpose, and it is the one thing this file gained
 * when the sum arrived. `./document.ts` is the TYPE and its constructors; what
 * points at what is this file's question, asked of a body and of a record with
 * the same rule underneath, and read forwards to build a face and backwards to
 * say who points at a document (`./backlinks.ts`). Split across the two
 * modules they would have been two answers to one question.
 */

/** Join `to` onto the directory of `from`, collapsing `.` and `..`. A `..` that
 *  would climb above the served directory is dropped rather than escaping it:
 *  there is nothing up there to name, and every caller matches the answer
 *  against files that were actually found. */
export const resolveRelative = (from: string, to: string): string => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of to.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

/**
 * The picture a markdown `![](…)` names, as a path relative to the served
 * directory — or `null` for a source this app does not draw at all.
 *
 * `from` is the file the markdown was written in: the outline, for a note; the
 * document itself, for a document. So a picture is resolved beside the text
 * that names it, just like a note link.
 *
 * Only a RELATIVE path to a picture survives: the address rule is
 * {@link relativeTo}'s, and the extension allowlist is this one's. A page that
 * fetched a remote image would be a page that told a third party what someone
 * is reading, and an address off the allowlist is a way of drawing something
 * that is not a file in this directory.
 */
export const pictureOf = (claims: Claims, from: string, src: string): string | null => {
  const resolved = relativeTo(from, src)
  return resolved !== null && isPicture(claims, resolved) ? resolved : null
}

/**
 * The file under the served directory a markdown address names, before anyone
 * asks WHAT KIND of file it has to be — or `null` for an address this app does
 * not resolve at all.
 *
 * The refusals live here, once, because there are two sinks and they are two
 * different things: a picture becomes a `/media/…` URL the server answers, a
 * link becomes the document's own address, which the client opens. A refusal added to one of
 * them and not the other would be a widening nobody meant — and the two lists
 * were character-for-character identical the moment there were two.
 *
 * No scheme (so no `http:`, no `data:`, no `javascript:`), no `//host`, no
 * absolute path, no bare fragment: everything on that list is either somewhere
 * else's business or a way of naming something that is not a file in this
 * directory. A `..` is not refused but CLAMPED by {@link resolveRelative}.
 *
 * A `%20` is a space in the filename, not a filename that contains a percent
 * sign. Markdown's portable spelling of a space in a destination is the
 * encoding, and the parser writes it into the href; decoding HERE — once,
 * per segment, the way a written address is read — is what stops the page
 * printer from encoding the percent again.
 */
const relativeTo = (from: string, to: string): string | null => {
  if (refusedHref(to)) return null
  const decoded = decodeHref(to)
  if (decoded === null || (decoded !== to && refusedHref(decoded))) return null
  return resolveRelative(from, decoded)
}

/** The refusals {@link relativeTo} applies to the href as written and again
 *  after decoding, so `%2Fetc/passwd.md` cannot sneak past as a relative path. */
const refusedHref = (href: string): boolean =>
  href === "" || href.startsWith("/") || href.startsWith("#") || SCHEME.test(href)

/**
 * Percent-decode one path, per segment — or `null` for an escape nothing
 * could have written. Per segment so `%2F` is a slash in a name rather than
 * a separator, matching how a written address is read.
 */
const decodeHref = (href: string): string | null => {
  if (!href.includes("%")) return href
  const segments = href.split("/").map(decodedSegment)
  return segments.includes(null) ? null : segments.join("/")
}

const decodedSegment = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}


/**
 * The path in this directory that a relative reference names, whatever suffix
 * it turns out to have — or `null` for a string that names no path at all.
 *
 * THE SIBLING of {@link pictureOf}, and the one that asks less rather than
 * more. The picture rule ends at an allowlist because its caller cannot ask
 * the directory: a markdown renderer rewrites an `href` without knowing what
 * the vault holds, so "is this a picture" has to be answered from the name.
 * THIS one's caller can ask — a property value becomes a link only where the
 * tab is holding the path in its file list (`@olai/web`'s `props/door.ts`) —
 * and existence is a stronger answer than any suffix rule: it lets an `.olai`
 * be named, which `bodyKind` refuses because an outline is a tree rather than
 * a body, and it refuses a `.md` the directory has not got, which a rendered
 * link would otherwise rewrite for a page the vault does not have.
 *
 * WHAT IT STILL OWNS is the half that is not the suffix, and it is the half
 * that matters: {@link relativeTo}'s refusals — no scheme, no `//host`, no
 * absolute path, no bare fragment — and {@link resolveRelative}'s clamping of
 * `..` to the served root. Those are one spelling for both of these, which
 * is exactly the arrangement the paragraph above {@link relativeTo} is
 * written to keep.
 */
export const pathedOf = (from: string, href: string): string | null =>
  relativeTo(from, href)

/** A URL scheme, or the `//host` that borrows the page's own. Tested before
 *  resolution, because a `:` is a character a path resolver would happily
 *  treat as part of a file name. */
const SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/

/**
 * BLOCK CONTEXT, LOCALLY — the lines that are a fenced or indented code block,
 * blanked to spaces so the wikilink scan below never sees inside one. The
 * scan, and so this mask, serve only the browser's preview line now.
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
 * answered by `./wikilinks.ts` whenever it is asked, never here.
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
 * block is text here exactly as it is on the page. What remains of the scan
 * the index used to read by: the preview line's, until the parser reaches it.
 *
 * ONE FORWARD SCAN, linear in the text, because this reads text nobody here
 * wrote. A link opens at the last `[[` before its `]]`, stays on one line,
 * holds no lone bracket, and is not opened by an escaped `[`.
 */
export const wikilinksIn = (text: string): ReadonlyArray<Wikilink> =>
  text.includes("[[") ? wikilinkScan(text, proseMask(text)) : NO_WIKILINKS

/**
 * The text with each wikilink as the words it shows — `[[kitchen-sink#Tables|the
 * table]]` is `the table` — which is what the page draws in its place. A
 * note's preview line reads it in the browser before the parser has loaded.
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

/** The answer for prose that points nowhere and for a record that does — which
 *  is most of both: ONE list, shared, as `./derive.ts` shares its own. */
const NO_LINKS: ReadonlyArray<Address> = []

/**
 * EVERY ADDRESS ONE RECORD POINTS AT, in the order it writes them.
 *
 * The forward half of a reference, per record — and it is a function of its own
 * because it is read BOTH WAYS: {@link outlineDocument} folds it into an
 * outline's face, and the references FOLD reads it to say which record of a
 * file an index entry's `at` came from. Two walks of the same fields would be
 * two answers to "does this node point there", and the page would draw one of
 * them while the face claimed the other.
 *
 * The WAYS are kept apart because the fold needs them apart: {@link
 * recordContributions} is this walk in the index's own vocabulary, so the
 * fold files a `see` under the id it names and a link under the address it
 * lands on — and here that is one list, deduped, which is the DRAWING's
 * answer. One walk, two projections.
 *
 * Three things a record can point at, and one it deliberately cannot:
 *
 *   - a `see`, the format's free cross-reference and the one edge no
 *     derivation reads, so the forward half of it belongs in a list of what
 *     this record points at.
 *   - a `[…](…)` in its TITLE, and one in its NOTE — the same rule a
 *     document's body is read by, so a link means the same thing wherever it
 *     is written ({@link readAddresses}).
 *
 * `after` and `blocks` are NOT here: they are the ORDERING graph, and saying
 * an ordering edge under the word "points at" would put one fact under a name
 * that means something else — the ruling `./backlinks.ts` already makes from
 * the other end.
 *
 * A MIRROR points at nothing of its own. It is a second placement of a node,
 * carrying no prose and no edge fields; what it shows is the node's, and the
 * node is where the reference is written.
 */
export const recordLinks = (claims: Claims, located: Located): ReadonlyArray<Address> =>
  recordContributions(claims, located).map((one) => one.address).filter(isAddress)

const isAddress = (address: Address | undefined): address is Address => address !== undefined

/** One record's written targets, in the fold's own vocabulary — what the index
 *  reads ({@link ./imports.ts}'s `contributionsOf`), in the order the record
 *  writes them. {@link recordLinks} is its deduped {@link Contribution.address}
 *  projection; the fold keeps the `way` and the target address for the way the
 *  index files under. */
export const recordContributions = (
  claims: Claims,
  located: Located,
): ReadonlyArray<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> => {
  const found: Array<{ readonly way: "see" | "link"; readonly address: Address; readonly at: Located }> = []
  if (isMirror(located.node)) return found
  for (const id of located.node.see ?? []) {
    const address = addressOf(claims, null, id)
    if (address !== null) found.push({ way: "see", address, at: located })
  }
  const said = recordRead(located.node)
  for (const address of readAddresses(claims, located.file, said.title)) found.push({ way: "link", address, at: located })
  if (said.desc !== null) {
    for (const address of readAddresses(claims, located.file, said.desc)) found.push({ way: "link", address, at: located })
  }
  return found
}

/**
 * EVERY ADDRESS A TEXT'S READING POINTS AT, in the order it writes them and
 * never twice — its links and its pictures, each resolved from `from`, the
 * file the text was written in. The reading made one call of the parser, so
 * code, a comment and an escape hold no link here exactly as on the page.
 */
export const readAddresses = (claims: Claims, from: string, said: Read): ReadonlyArray<Address> => {
  let found: Array<Address> | undefined
  let seen: Set<string> | undefined
  for (const link of said.links) {
    const address = linkTo(claims, from, link.url)
    if (address === null) continue
    const written = printAddress(address)
    if ((seen ??= new Set()).has(written)) continue
    seen.add(written)
    ;(found ??= []).push(address)
  }
  return found ?? NO_LINKS
}

/** The name of a wikilink as read — its target and its `#` parts, the name
 *  the references index files it under. */
const nameOf = (link: ReadWikilink): string => [link.target, ...link.fragments].join("#")

/** The names the wikilinks of some readings write, in order and never twice. */
export const wikilinkNames = (reads: ReadonlyArray<Read>): ReadonlyArray<string> => {
  let named: Set<string> | undefined
  for (const said of reads) {
    for (const link of said.wikilinks) (named ??= new Set()).add(nameOf(link))
  }
  return named === undefined ? NO_NAMES : [...named]
}

const NO_NAMES: ReadonlyArray<string> = []

/** The wikilinks one record writes in its title and its note — what the
 *  references index files under each name, beside {@link recordContributions}.
 *  A placement writes none. */
export const recordWikilinks = (located: Located): ReadonlyArray<string> => {
  if (isMirror(located.node)) return NO_NAMES
  const said = recordRead(located.node)
  return wikilinkNames(said.desc === null ? [said.title] : [said.title, said.desc])
}

/** What one written link names, or `null` — the grammar's three arms, told
 *  apart by where the `#` is.
 *
 * THE PATH HALF IS WIDE on purpose: any relative path a file of the set could
 * hold is a document address, whatever suffix it carries, because the set
 * gives EVERY file a page. An outline is a document with a page and a
 * reading of its own, a `.pdf` is a body whose page draws it, and `![](…)`,
 * a picture in the reading, names the same document an `[…](…)` would. The
 * renderer's own half of the same
 * question — what a rewritten `href` is allowed to point at — asks
 * {@link bodyKind} directly and is NOT this one. This one reads the whole
 * grammar — the path, the kind it names, and the address it is spelled as —
 * and the renderer's narrower question is its own. */
const linkTo = (claims: Claims, from: string, href: string): Address | null => {
  const cut = href.indexOf("#")
  if (cut === 0) return addressOf(claims, null, href.slice(1))
  const path = cut === -1 ? href : href.slice(0, cut)
  const resolved = pathedOf(from, path)
  return resolved === null ? null : addressOf(claims, resolved, cut === -1 ? null : href.slice(cut + 1))
}
