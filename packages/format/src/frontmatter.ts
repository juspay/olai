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
 * ## Where the block ENDS is THE ECOSYSTEM's rule, spelled here
 *
 * Not "a `---` somewhere near the top", and the reason is not internal: a `.md`
 * in somebody's vault is read by other things too — GitHub renders it, an
 * editor colours it, a static site builds from it — and every one of them uses
 * micromark's frontmatter construct or a copy of it. A vault whose owner sees
 * the block hidden on GitHub and drawn as a phantom heading here has met two
 * answers about their own file. So {@link matterIn} is that construct's rule,
 * written out, and held to it by a test (`@olai/web`'s
 * `markdown/frontmatter.test.ts`, which renders each corner below through
 * `remark-frontmatter` and through this function and requires the same page):
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
 * This is not a YAML parser and does not become one. What it reads is the
 * subset a document property can BE — {@link CustomValue} is text or a list of
 * text, and nothing else — so the sliver of YAML that maps onto it is the whole
 * of what a wider reading could deliver anyway. A number, a boolean and a date
 * all arrive as the text somebody typed, which is `./custom.ts`'s own standing
 * ruling: "a value that wants to be a number can be one the day a reading needs
 * it rather than the day a writer guesses".
 *
 * **THE LIBRARY WAS WEIGHED, AND MEASURED, AND NOT TAKEN** — written down here
 * so the next reader does not have to re-run it. `yaml` is already in
 * `bun.lock` (cucumber's), and this repo's standing rule is that a focused
 * library beats a hand-roll (`fastest-levenshtein` is here on exactly that
 * argument). Three things put this one the other way:
 *
 *   - **It would ride in the EAGER browser bundle, for nothing.** This package
 *     is bundled into the client, and `./filter.ts` reaches {@link proseIn} per
 *     keystroke — so the module is in the client's graph whatever the split.
 *     Adding `yaml` to it and rebuilding costs **+10.6 KB brotli** on the two
 *     `main` chunks (250,956 → 261,577 B, measured), and the browser never
 *     parses a block: a face is built at the DECODE and its props travel the
 *     wire. That is the same cost the whole markdown pipeline is a lazy chunk
 *     to avoid (`@olai/web`'s `markdown/pipeline.ts`, 94 KB brotli).
 *   - **It replaces the lexing, not the decision.** A parse answers with maps,
 *     nested arrays, numbers, booleans and dates; `Custom` holds two shapes. So
 *     a projector from `unknown` down to text-or-list-of-text would still have
 *     to be written and would still have to decide what each of those becomes —
 *     the same judgment this file makes, one layer later and less legibly.
 *   - **It fails the whole block.** `parse` THROWS on a malformed one, so a
 *     typo would cost a document its entire record; the reading below refuses
 *     ONE KEY at a time, which is the behaviour the design wants.
 *
 * The precedent it follows is in this package already, twice: {@link ./slug.ts}
 * reads heading LINES rather than gaining a markdown parser, and
 * {@link ./documents.ts}'s `linksIn` scans rather than parses — both because
 * this package is the floor the write gate stands on.
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
 * A `#` ANYWHERE IN A FLOW SEQUENCE refuses the list, and that is the same
 * sentence rather than a new one: `[#home, #kitchen]` is not a list of two
 * tags — `yaml` refuses it, because a plain scalar may not OPEN with a `#` —
 * and `[a #b, c]` is a sequence whose closing bracket a comment ate. Both are
 * errors to the library and both are a key this document does not carry here.
 * `['#home', '#kitchen']` is how that list is written, and `[kitchen#2, x]`
 * needs no quoting at all: a `#` with no whitespace in front of it is part of
 * the word. `./frontmatter.library.test.ts` holds every one of those against
 * the real parser.
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
 * IT IS THE ONE SPELLING OF THE SKIP, in this package and in the browser
 * alike. {@link ./documents.ts}'s `firstLine` and {@link ./slug.ts}'s
 * `headingsIn` ask it themselves, because a BODY is the only thing either is
 * ever about; {@link ./document.ts}'s `bodiedDocument` asks it on behalf of
 * `tagsIn` and `linksIn`, because those two are also asked of a record's title
 * and note, where a leading `---` is a thematic break like any other; and
 * `./filter.ts`'s document fold asks it so a word only the block holds is
 * found by `prop:` rather than by typing it.
 *
 * AND THE BROWSER SPENDS IT TOO, which is why it is exported from the package
 * (`./index.ts`): the three faces that draw a whole file strip the block with
 * this call before the markdown pipeline ever sees it (`@olai/web`'s
 * `document/faces.tsx`, `document/DocRef.tsx`, `day/DayNote.tsx`). So the page
 * and the face cannot disagree about which lines a document has — they are the
 * same function, rather than two rules held together by a test.
 *
 * A `remark-frontmatter` in that pipeline was the other way to do it, and it
 * is wrong for a reason worth keeping written down: that is ONE pipeline for
 * every piece of markdown the app draws, so the plugin would change the dialect
 * for a node's NOTE and for the agent's replies as well — hiding a leading
 * `---` block off the screen while `tagsIn` and `linksIn` went on reading it as
 * the prose it is. Two readings of one block, which is the thing this module
 * exists to end.
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
  if (opens === -1 || !isFence(body, 0, opens)) return null
  let at = opens + 1
  while (at < body.length) {
    const end = body.indexOf("\n", at)
    if (isFence(body, at, end === -1 ? body.length : end)) {
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
const SPACE = " ".charCodeAt(0)
const TAB = "\t".charCodeAt(0)
const RETURN = "\r".charCodeAt(0)

/**
 * Is the span `[from, to)` of `text` the block's fence — exactly three dashes
 * at the left margin, and after them nothing a line ending may carry?
 *
 * OVER OFFSETS rather than over a line, which is what keeps the walk above
 * allocation-free on the path that matters: an UNCLOSED `---` is scanned to
 * the end of the file before it can be refused, and a line materialised per
 * line of a whole document is the cost `./documents.ts`'s `firstLine` and
 * `./slug.ts`'s `headingsIn` both refuse by name. Every line of that walk now
 * costs three `charCodeAt`s and stops on the first one that is not a dash.
 */
const isFence = (text: string, from: number, to: number): boolean =>
  to - from >= 3 && text.charCodeAt(from) === DASH && text.charCodeAt(from + 1) === DASH &&
  text.charCodeAt(from + 2) === DASH && blank(text, from + 3, to)

/** Whether the span holds only the whitespace a line ending may drag along —
 *  spaces, tabs, and the `\r` of a file written on Windows. */
const blank = (text: string, from: number, to: number): boolean => {
  for (let at = from; at < to; at++) {
    const char = text.charCodeAt(at)
    if (char !== SPACE && char !== TAB && char !== RETURN) return false
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
  // THE KEY A `- item` LINE WOULD BELONG TO, and what it has collected — one
  // value, because they are one fact: a list of items under no key is not a
  // state this reading has. `null` is "no key is open", so a stray item is an
  // item under nothing and is dropped with everything else that is refused.
  //
  // A key that collected NOTHING is dropped by {@link claim}, which refuses a
  // value that is nothing and `[]` is one — so `owners:` with no sequence
  // under it needs no case of its own here.
  let open: { readonly key: string; readonly items: Array<string> } | null = null
  const close = (): void => {
    if (open !== null) claim(props, open.key, open.items)
    open = null
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
      // A member is a SCALAR — `./frontmatter.ts`'s two-function split, so a
      // nested list is refused by the type rather than by a check here. An
      // empty item is YAML's `null`, which a list of text has no member for,
      // and refuses the list the same way.
      const value = scalarOf(item)
      if (value === null || value === "") {
        open = null
        continue
      }
      open.items.push(value)
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
      open = { key, items: [] }
      continue
    }
    const value = valueIn(rest)
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
 * WHAT A KEY MAY HOLD — text, a list of text, or `null` for a spelling this
 * reading refuses.
 *
 * TWO FUNCTIONS AND NOT ONE, and the split is the type doing the work rather
 * than a comment: a value may be a list, and a MEMBER of a list may not. This
 * one is the whole vocabulary; {@link scalarOf} below is the half a member is
 * drawn from, so "a nested list is not a member" is a fact the compiler holds
 * at both sites that need it, instead of a `typeof value !== "string"` each
 * had to remember to write.
 */
const valueIn = (text: string): CustomValue | null =>
  // A flow sequence, and only when the bracket it opened is the very last
  // character. `[a, b] # note` falls through to {@link scalarOf}, which refuses
  // a leading `[` — so it is refused rather than half-read, because taking a
  // comment off the inside of a flow context correctly is having a YAML parser,
  // and guessing at it is how a reader ends up with a value nobody wrote.
  text.startsWith("[") && text.endsWith("]")
    ? flowSequence(text.slice(1, -1))
    : scalarOf(text)

/**
 * ONE SCALAR — the value a key holds when it is not a list, and the only thing
 * a list's member may be.
 *
 * The dispatch is on the FIRST character, and the quoted arm requires its
 * closing quote at the very END for {@link valueIn}'s reason above.
 */
const scalarOf = (text: string): string | null => {
  const first = text[0]
  if (first === undefined) return ""
  if (first === '"' || first === "'") return quoted(text, first)
  // A flow collection has no shape a member can hold and no shape a property
  // can hold NESTED; the three sigils are YAML constructs whose meaning is
  // elsewhere in the document, and a block scalar is a value written on the
  // lines below rather than on this one.
  if (first === "[" || first === "{" || first === "&" || first === "*" || first === "!") {
    return null
  }
  if ((first === "|" || first === ">") && blank(text, 1, text.length)) return null
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
 * Split on the commas this reading can see, which are the ones a quote does not
 * hold. WHETHER A MEMBER IS ONE is {@link scalarOf}'s question and not a second
 * test here: a nested collection opens a bracket or a brace, which that
 * function already refuses, so `[a, [b]]` loses the whole list rather than
 * being flattened into members nobody wrote.
 *
 * An empty `[]` is a list of nothing, which {@link claim} reads as a key the
 * file does not carry — the same answer `[]` gets on a record (`./write.ts`).
 */
const flowSequence = (inside: string): ReadonlyArray<string> | null => {
  // THE EMPTY LIST, decided before the walk rather than by a sentinel inside
  // it: `[]` holds no member, and {@link claim} reads a list of nothing as a
  // key the file does not carry — the same answer `[]` gets on a record
  // (`./write.ts`). Whitespace-only input can hold no comma and no quote, so
  // this is the only way it could ever have left the loop.
  if (inside.trim() === "") return []
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
    // A `#` WITH WHITESPACE IN FRONT OF IT OPENS A COMMENT, and a comment in a
    // flow context runs to the END OF THE LINE — taking the closing bracket
    // with it, so `[a #b, c]` is a sequence nobody ever closed and `yaml`
    // refuses it outright. {@link scalarOf}'s comment rule is right for the two
    // places a comment really can end a value (after `key: `, and after a `-`
    // item, where the line ending IS the value's end) and wrong here, where it
    // would hand back `["a", "c"]` — a list assembled out of what a comment ate.
    // So the whole list goes, which is this function's standing rule for a
    // member it cannot read.
    if (char === "#" && (inside[at - 1] === " " || inside[at - 1] === "\t")) return null
    if (char !== "," && char !== undefined) continue
    const value = scalarOf(inside.slice(from, at).trim())
    from = at + 1
    if (value === null || value === "") return null
    members.push(value)
  }
  return members
}
