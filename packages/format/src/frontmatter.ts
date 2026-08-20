/**
 * THE `---` BLOCK AT THE TOP OF A `.md`, read at last.
 *
 * It was the one construct in this format that was neither parsed nor
 * rendered nor stripped — only SKIPPED, in exactly one scanner
 * ({@link ./slug.ts}'s `headingsIn`, whose own comment said "Nothing here
 * READS frontmatter"). So a document opening with one was drawn with a
 * thematic break and a phantom `<h2>title: x</h2>` that gained an anchor and a
 * row in the table of contents; its sidebar title was the literal `---`; and a
 * `#`-looking YAML value was indexed as a tag somebody wrote. Three readings
 * of one block, none of them agreeing with the other two.
 *
 * This module is the one reading. Two questions, and everything else asks one
 * of them:
 *
 *   - {@link proseIn} — the body WITHOUT the block, which is what every scanner
 *     that reads a document's content wants. The face's title, its links, its
 *     tags and its headings are all facts about the prose, and none of them is
 *     a fact about the record above it.
 *   - {@link frontmatterIn} — the keys, as {@link ./custom.ts}'s `Custom`,
 *     which is what a document's PROPERTIES are ({@link ./document.ts}'s
 *     `Face.props`, and `prop:` in the query grammar).
 *
 * ## Where the block ENDS is micromark's rule, spelled here
 *
 * Not "a `---` somewhere near the top": the browser renders through
 * `remark-frontmatter`, so what counts as frontmatter is decided by
 * micromark's frontmatter construct, and a second answer here would be a
 * document whose page hides a block its face read — or worse, the other way
 * round. So {@link matterIn} is that construct's rule, written out and pinned
 * against the real pipeline (`@olai/web`'s `markdown/slugs.test.ts`, which
 * holds the two readings to each other over bodies that carry one):
 *
 *   - it OPENS only on the very first line of the file, and only when that
 *     line is exactly three dashes with nothing after it but spaces or tabs.
 *     `----` opens nothing; ` ---` opens nothing.
 *   - it CLOSES on the next such line. Not `----`, not an indented one, and
 *     not YAML's own `...` — the yaml preset takes the dash fence alone.
 *   - **an unclosed block is not frontmatter at all.** A file that opens `---`
 *     and never closes it is a thematic break followed by prose, which is what
 *     the renderer draws — and it is the case the scanner this replaces got
 *     wrong in the most expensive direction, swallowing every heading in the
 *     document.
 *
 * A `\r` before the line ending is taken off with the trailing spaces, so a
 * file written on Windows opens and closes the same block on both sides.
 *
 * ## What a VALUE may be, and what this refuses
 *
 * This is not a YAML parser and does not become one, for the reason
 * {@link ./slug.ts} holds no markdown parser and {@link ./documents.ts}'s
 * `linksIn` is a scan: this package is the floor the write gate stands on.
 * What it reads is the subset a document property can BE — {@link CustomValue}
 * is text or a list of text, and nothing else — so the sliver of YAML that maps
 * onto it is the whole of what a wider reading could deliver anyway. A number,
 * a boolean and a date all arrive as the text somebody typed, which is
 * `./custom.ts`'s own standing ruling: "a value that wants to be a number can
 * be one the day a reading needs it rather than the day a writer guesses".
 *
 * READ:
 *
 *   - `key: value` at the left margin — a plain scalar, with a trailing
 *     `# comment` taken off where YAML puts one (a `#` after whitespace).
 *   - `key: "value"` / `key: 'value'` — a quoted scalar, where the quotes are
 *     the FIRST and LAST characters of what follows the colon. `\"` and `\\`
 *     are unescaped inside double quotes and `''` inside single ones; no other
 *     escape is, which is said here rather than discovered.
 *   - `key: [a, b]` — a flow sequence of scalars.
 *   - a block sequence under a key with no inline value, its items written
 *     `- item`, at the left margin or indented under it.
 *
 * REFUSED — and refused ONE KEY AT A TIME, never by abandoning the block:
 * nested maps, block scalars (`|`, `>`), flow maps, anchors, aliases and
 * explicit tags (`&`, `*`, `!`), a multi-line plain scalar, and anything after
 * a quoted or bracketed value's closing character. A refused key is simply not
 * a property this document carries — which is the same answer a document gets
 * for a key nobody wrote, and is why a reader can never be shown half a value.
 *
 * A key written twice keeps its FIRST claim, exactly as the id table does
 * (`./derive.ts`'s `byId`): a later line silently replacing an earlier one is
 * the kind of thing a person has to run the parser to see.
 *
 * A key holding nothing is a key the document does not carry, which is
 * `./write.ts`'s `nothing` read one map in — the same rule
 * {@link ./custom.ts}'s `withCustom` applies when a property is set to `""`,
 * so `title:` with no value and no `title` at all are one document.
 *
 * ## What is NOT here, and why
 *
 * The block does not become a RECORD. A `date:` in frontmatter is a property
 * named "date" and not the journal's day; a `done:` is a property and not a
 * mark; a `tags:` is a property and not the face's tags, which this format
 * writes with a sigil in prose (`./derive.ts`'s one alphabet). That is the
 * ruling this round takes and not an omission: a document carrying a real date
 * would have to appear on the day page, the agenda and the calendar, all three
 * of which are readings of a NODE — and a `date:` that a search selects on
 * while the day it names does not draw it is exactly the two-answers-to-one-word
 * this grammar refuses everywhere else. Properties are the half that needs no
 * such answer: `prop:` is an open namespace by construction, so a document's
 * keys answer it the same way a record's do, through one
 * `propKeyOf` (`./filter.ts`).
 */

import type { Custom, CustomValue } from "./custom.ts"
import { nothing } from "./write.ts"

/**
 * A body with its frontmatter taken off — the text every reading of a
 * document's CONTENT is about.
 *
 * IDENTITY for a body that opens with none, which is nearly all of them: the
 * scan below answers `null` on the first character of the first line, so this
 * costs a `startsWith` per document and allocates nothing.
 *
 * It is the one spelling of the skip, and the three callers are the three
 * readings that used to have zero, one and no copies of it between them:
 * {@link ./documents.ts}'s `firstLine` and {@link ./slug.ts}'s `headingsIn`
 * ask it themselves, because a BODY is the only thing either is ever about;
 * {@link ./document.ts}'s `bodiedDocument` asks it on behalf of `tagsIn` and
 * `linksIn`, because those two are also asked of a record's title and note,
 * where a leading `---` is a thematic break like any other.
 */
export const proseIn = (body: string): string => {
  const matter = matterIn(body)
  return matter === null ? body : body.slice(matter.from)
}

/**
 * The properties a body's frontmatter writes — EMPTY for a body that opens
 * with none, and empty for a block this reading finds nothing readable in.
 *
 * `Custom` rather than a type of its own, because a document's properties are
 * a record's properties: one open namespace, no key given a meaning by olai,
 * text or a list of it. What reads them is one `propKeyOf`, one props drawer
 * and one `prop:` clause, and a second value type would have been the second
 * spelling that eventually disagreed about what `prop:PR` matches.
 */
export const frontmatterIn = (body: string): Custom => {
  const matter = matterIn(body)
  return matter === null ? NO_PROPS : propsIn(matter.text)
}

/** One empty map for every document that carries no properties, which is
 *  nearly all of them — `./documents.ts`'s `NO_LINKS` next door, for its
 *  reason. */
const NO_PROPS: Custom = {}

/** Where a body's frontmatter is: the text BETWEEN the fences, and the offset
 *  the prose begins at. `null` for a body that carries none — which includes
 *  one whose opening fence is never closed. */
const matterIn = (body: string): { readonly text: string; readonly from: number } | null => {
  // The cheap negative first, and it is the answer for every document in a
  // directory but the few that carry a block: the fence is the FIRST line, so
  // one character decides it.
  if (body.charCodeAt(0) !== DASH) return null
  const opens = body.indexOf("\n")
  if (opens === -1 || !isFence(body.slice(0, opens))) return null
  let at = opens + 1
  while (at <= body.length) {
    const end = body.indexOf("\n", at)
    const line = end === -1 ? body.slice(at) : body.slice(at, end)
    if (isFence(line)) {
      return { text: body.slice(opens + 1, at), from: end === -1 ? body.length : end + 1 }
    }
    if (end === -1) break
    at = end + 1
  }
  // UNCLOSED IS NOT FRONTMATTER, which is micromark's answer and now this
  // one — the header says what reading it the other way cost.
  return null
}

const DASH = "-".charCodeAt(0)

/** Is this line the block's fence — exactly three dashes at the left margin,
 *  and after them nothing a line ending may carry? */
const isFence = (line: string): boolean =>
  line.length >= 3 && line.charCodeAt(0) === DASH && line.charCodeAt(1) === DASH &&
  line.charCodeAt(2) === DASH && blank(line.slice(3))

/** Whether what is left of a line is only the whitespace a line ending may
 *  drag along — spaces, tabs, and the `\r` of a file written on Windows. */
const blank = (rest: string): boolean => {
  for (const char of rest) {
    if (char !== " " && char !== "\t" && char !== "\r") return false
  }
  return true
}

/**
 * The keys of one block, read a line at a time.
 *
 * SPLIT rather than scanned, which is the opposite of what {@link
 * ./documents.ts}'s `firstLine` and `headingsIn` do and is right here for the
 * reason theirs is right there: those two run over the whole body of every
 * document in a served directory, where an allocation per line is an
 * allocation per line of the corpus. This runs over the few lines above a
 * document's first, on the documents that have any — and it needs to look
 * BACK at the key a sequence item belongs to, which a forward scan would have
 * to carry in state anyway.
 */
const propsIn = (region: string): Custom => {
  const props: Record<string, CustomValue> = {}
  // The key a `- item` line would belong to, and what it has collected. `null`
  // means no key is open, so a stray item is an item under nothing and is
  // dropped with everything else this reading refuses.
  let open: string | null = null
  let items: Array<string> | null = null
  const close = (): void => {
    if (open !== null && items !== null) claim(props, open, items)
    open = null
    items = null
  }
  for (const raw of region.split("\n")) {
    const line = raw.replace(TRAILING, "")
    const text = line.trimStart()
    // A blank line and a whole-line comment say nothing about the key above
    // them, so neither closes a sequence that is still being written.
    if (text === "" || text.startsWith("#")) continue
    const item = sequenceItem(text)
    if (item !== null) {
      // An item belongs to the key above it wherever YAML lets it sit — at the
      // left margin, or indented under the key. A refused item takes the whole
      // list with it: a list a reader would see one member short is worse than
      // a key they can see is missing.
      if (open === null) continue
      const value = scalarOf(item)
      // An empty item is YAML's `null`, which a list of text has no member
      // for — so it refuses the list exactly as a nested one does.
      if (typeof value !== "string" || value === "") {
        open = null
        items = null
        continue
      }
      ;(items ??= []).push(value)
      continue
    }
    close()
    // Only the LEFT MARGIN is a key. Anything indented here is the inside of a
    // nested map or the continuation of a multi-line scalar, and both are
    // refused whole (the header says why one key at a time).
    if (line !== text) continue
    const split = splitKey(text)
    if (split === null) continue
    const [key, rest] = split
    // No inline value: the key is waiting for a block sequence, and holds
    // nothing if none follows.
    if (rest === "") {
      open = key
      continue
    }
    const value = scalarOf(rest)
    if (value !== null) claim(props, key, value)
  }
  close()
  return props
}

/** The `\r` and the trailing whitespace a line may carry, taken off before
 *  anything is read — one rule, so a file written on Windows is the same
 *  document as one written anywhere else. */
const TRAILING = /[ \t\r]+$/

/** One key SET, first claim winning and the writer's rule for absence
 *  applied — {@link ./custom.ts}'s `withCustom` says why a value that is
 *  nothing is a key the file does not carry. */
const claim = (
  props: Record<string, CustomValue>,
  key: string,
  value: CustomValue,
): void => {
  if (key in props || nothing(value)) return
  props[key] = value
}

/** A block-sequence item's text — `- brass` is `brass`, `-` alone is the empty
 *  string — or `null` for a line that is not one. The space after the dash is
 *  YAML's own requirement and is what tells an item from `-42`. */
const sequenceItem = (text: string): string | null => {
  if (!text.startsWith("-")) return null
  const after = text[1]
  if (after === undefined) return ""
  if (after !== " " && after !== "\t") return null
  return text.slice(2).trim()
}

/** A key and what follows its colon, or `null` for a line that is not a
 *  mapping at all.
 *
 *  The separator is YAML's: a colon with a space after it, or a colon that
 *  ends the line. So a key may hold a colon that is part of a word
 *  (`http://x` is not a key) and a value may hold as many as it likes. A key
 *  that is empty, or that opens with a `#` this line's own comment rule would
 *  already have taken, is not one. */
const splitKey = (text: string): readonly [key: string, rest: string] | null => {
  let at = text.indexOf(":")
  while (at !== -1) {
    const after = text[at + 1]
    if (after === undefined || after === " " || after === "\t") {
      const key = text.slice(0, at).trimEnd()
      return key === "" || key.startsWith("#") ? null : [key, text.slice(at + 1).trim()]
    }
    at = text.indexOf(":", at + 1)
  }
  return null
}

/**
 * One value, as far as a property can hold one — text, a list of text, or
 * `null` for a spelling this reading refuses.
 *
 * The dispatch is on the FIRST character, and every arm that opens a bracket
 * or a quote requires the matching one at the very END: `[a, b] # note` is
 * refused rather than half-read, because taking a comment off the inside of a
 * flow context correctly is having a YAML parser, and guessing at it is how a
 * reader ends up with a value nobody wrote.
 */
const scalarOf = (text: string): CustomValue | null => {
  const first = text[0]
  if (first === undefined) return ""
  if (first === '"' || first === "'") return quoted(text, first)
  if (first === "[") return text.endsWith("]") ? flowSequence(text.slice(1, -1)) : null
  // A flow map has no shape a property can hold; the four sigils are YAML
  // constructs whose meaning is elsewhere in the document, and a block scalar
  // is a value written on the lines below rather than on this one.
  if (first === "{" || first === "&" || first === "*" || first === "!") return null
  if ((first === "|" || first === ">") && blank(text.slice(1))) return null
  // A `#` HERE is a comment and not a value, because the colon already put a
  // space in front of it: `pr: #176` says the key holds nothing, and
  // `pr: "#176"` is how that value is written. It is {@link plain}'s own rule,
  // asked at the one position that function cannot see the whitespace before.
  if (first === "#") return ""
  return plain(text)
}

/** A plain scalar: what is left once YAML's comment — a `#` with whitespace in
 *  front of it — is taken off the end. A `#` with no space before it is part
 *  of the word, which is what keeps `topic: kitchen#2` whole. */
const plain = (text: string): string => {
  for (let at = 1; at < text.length; at++) {
    const before = text[at - 1]
    if (text[at] === "#" && (before === " " || before === "\t")) return text.slice(0, at).trimEnd()
  }
  return text
}

/**
 * A quoted scalar — the quotes off, and the escapes YAML spells with the quote
 * character undone.
 *
 * `''` inside single quotes is one apostrophe, which is the only escape single
 * quotes have; `\"` and `\\` inside double quotes are the two that matter for
 * a value somebody types. Every other backslash sequence is left AS WRITTEN
 * rather than guessed at — `\n` in a property is a backslash and an n, which
 * is a thing this reading says out loud rather than a thing it silently gets
 * wrong.
 *
 * `null` when the closing quote is not the last character: a value with
 * anything after it is not one this reads.
 */
const quoted = (text: string, quote: string): string | null => {
  if (text.length < 2 || !text.endsWith(quote)) return null
  const inside = text.slice(1, -1)
  if (quote === "'") {
    // A lone apostrophe inside single quotes ends the scalar, so a value with
    // one is a value with something after it.
    return /(^|[^'])'([^']|$)/.test(inside) ? null : inside.replace(/''/g, "'")
  }
  let out = ""
  for (let at = 0; at < inside.length; at++) {
    const char = inside[at] as string
    if (char !== "\\") {
      // An unescaped double quote inside double quotes is the same refusal.
      if (char === '"') return null
      out += char
      continue
    }
    const next = inside[at + 1]
    if (next === '"' || next === "\\") {
      out += next
      at++
      continue
    }
    out += char
  }
  return out
}

/**
 * A flow sequence's members — `[a, b, c]` between the brackets.
 *
 * Split on the commas this reading can see, which are the ones at the top
 * level of the brackets: a member that opens a quote holds its commas, and a
 * member that opens a bracket or a brace is a nested collection, which is a
 * shape a property has nowhere to put. So a nesting refuses the whole list
 * rather than flattening it into members nobody wrote.
 *
 * An empty `[]` is a list of nothing, which {@link claim} reads as a key the
 * file does not carry — the same answer `[]` gets on a record (`./write.ts`).
 */
const flowSequence = (inside: string): ReadonlyArray<string> | null => {
  const members: Array<string> = []
  let from = 0
  let quote: string | null = null
  for (let at = 0; at <= inside.length; at++) {
    const char = inside[at]
    if (quote !== null) {
      if (char === undefined) return null
      if (char === "\\" && quote === '"') at++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "[" || char === "{") return null
    if (char !== "," && char !== undefined) continue
    const member = inside.slice(from, at).trim()
    from = at + 1
    if (member === "" && char === undefined && members.length === 0) break
    const value = scalarOf(member)
    if (value === null || typeof value !== "string" || value === "") return null
    members.push(value)
  }
  return members
}
