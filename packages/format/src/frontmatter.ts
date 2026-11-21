/**
 * THE `---` BLOCK AT THE TOP OF A `.md`, read at last.
 *
 * It was the one construct in this format that was neither parsed nor
 * rendered nor stripped — only SKIPPED, in exactly one scanner (the heading
 * scan this package held before it read text through `@olai/prose`, whose own
 * comment said "Nothing here READS frontmatter"). So a document opening with one was drawn with a
 * thematic break and a phantom `<h2>title: x</h2>` that gained an anchor and a
 * row in the table of contents; its sidebar title was the literal `---`; and a
 * `#`-looking YAML value was indexed as a tag somebody wrote. Three readings
 * of one block, none of them agreeing with the other two.
 *
 * This module is the one reading. Two questions, and everything else asks one
 * of them:
 *
 *   - `@olai/prose`'s `proseIn` — the body WITHOUT the block, which is what every scanner
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
 * answers about their own file. So `@olai/prose`'s `matterIn` is that construct's rule,
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
 * It reads the block's keys a line at a time rather than gaining a YAML
 * library, because this package is the floor the write gate stands on and a
 * key per line is all a document's record needs.
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
import { matterIn } from "@olai/prose/frontmatter.ts"
import { nothing } from "./write.ts"

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

/**
 * THE BLOCK, WRITTEN — the few keys a gesture sets or takes off, and every
 * other byte of the file left exactly as it was.
 *
 * A NOTE'S PROPERTIES ARE THE NOTE'S, which is the whole shape of this: the
 * block at the top of a `.md` is a thing a person writes by hand, with their
 * own order, their own comments, their own quoting and whatever a YAML they
 * like has put in it. So this is a SPLICE and not a serialiser — there is no
 * round trip through a parsed map, because a round trip through this module's
 * reading would quietly drop every key it refuses to read and reformat the
 * ones it does. One entry is replaced in place, one is appended, one is cut;
 * everything else keeps its bytes, its order and its line endings.
 *
 * WHAT A CHANGE IS: a key and the text it should hold, or `null` for a key
 * that should not be there. Setting a key the block already writes replaces
 * that key's WHOLE entry — its line and, where it holds a block list, the
 * items under it — in place, so a value that was a list becomes a scalar
 * without leaving half a list behind. Setting one it does not write appends it
 * at the end of the block, and if there is no block at all a new one is made
 * at the top of the file. Removing the last key takes the block with it. A key
 * written TWICE is one key to {@link propsIn} (the first claim wins), so every
 * entry of it is cut and the surviving value is written at the first one's
 * place — otherwise a removal would uncover a value nobody could see.
 *
 * THE VALUE IS SPELLED BY ASKING THIS MODULE'S OWN READING, rather than by a
 * table of characters YAML gives a meaning to: a plain scalar is written where
 * {@link propsIn} reads that exact line back as that exact value, and a
 * double-quoted one otherwise. So the invariant —
 * `frontmatterIn(matterWith(text, [[key, value]]))[key] === value` — is held
 * by the writer consulting the reader rather than by two tables kept in step
 * by hand.
 *
 * TWO VALUES IT CANNOT PROMISE THAT OF, and both are named rather than
 * silently mangled. A value carrying a LINE BREAK is written as the escape
 * YAML spells it with, which this module's reading hands back as a backslash
 * and a letter (`quoted` says why it refuses to guess at escapes) — the block
 * stays well formed, which is the property that matters, and no caller here
 * has a value with a break in it. An EMPTY value is written as `""`, and the
 * reading treats a key holding nothing as a key the file does not carry
 * (`./custom.ts`'s `nothing`) — so setting one says the same thing as removing
 * it.
 */
export const matterWith = (
  text: string,
  changes: ReadonlyArray<readonly [key: string, value: string | null]>,
): string => {
  const matter = matterIn(text)
  const from = matter === null ? 0 : text.indexOf("\n") + 1
  const lines = matter === null ? [] : linesOf(matter.text)
  const entries = entriesOf(lines)
  // THE WRITE, held as three small decisions over the ORIGINAL lines rather
  // than as an array edited in flight: which lines are gone, which one line is
  // rewritten, and which keys had nowhere to go and are appended. A splice
  // that mutated as it went would have to keep every later entry's indices in
  // step with its own edits, for no gain.
  const gone = new Set<number>()
  const rewritten = new Map<number, string>()
  const appended = new Map<string, string>()
  // THE LINE ENDING THE FILE IS WRITTEN WITH, for the lines this adds. An
  // untouched line keeps its own either way; what this decides is what a file
  // written on Windows gets when a key is appended to it.
  const ending = text.includes("\r\n") ? "\r\n" : "\n"
  for (const [key, value] of changes) {
    const mine = entries.filter((entry) => entry.key === key)
    appended.delete(key)
    for (const entry of mine) {
      for (let at = entry.from; at <= entry.to; at++) gone.add(at)
      rewritten.delete(entry.from)
    }
    if (value === null) continue
    const written = spelled(key, value)
    const first = mine[0]
    if (first === undefined) {
      appended.set(key, written + ending)
      continue
    }
    gone.delete(first.from)
    // THE REWRITTEN LINE KEEPS THE ENDING IT HAD, so one entry replaced in a
    // file written on Windows does not become the one line with a bare `\n`.
    const was = lines[first.from] as string
    rewritten.set(first.from, written + (was.endsWith("\r\n") ? "\r\n" : was.endsWith("\n") ? "\n" : ""))
  }
  const region = lines.map((line, at) => gone.has(at) ? "" : rewritten.get(at) ?? line).join("")
    + [...appended.values()].join("")
  // AN EMPTY BLOCK IS NO BLOCK: the last key off takes the fences with it, and
  // the prose that followed them starts the file. A block that still holds a
  // COMMENT is not empty — those are bytes somebody wrote, and this module
  // takes nobody's writing off a file it was asked to set one key in.
  if (region.trim() === "") return matter === null ? text : text.slice(matter.from)
  if (matter === null) return `---${ending}${region}---${ending}${text}`
  return text.slice(0, from) + region + text.slice(from + matter.text.length)
}

/** The lines of a region, each one KEEPING its own ending — what makes the
 *  splice above byte-exact for every line it does not touch, including the
 *  `\r` of a file written on Windows. */
const linesOf = (region: string): ReadonlyArray<string> => region.match(/[^\n]*\n|[^\n]+/g) ?? []

/** One line as the reading sees it: its ending, and the whitespace that line
 *  ending may drag along, taken off — {@link untrailed}'s rule, asked of a
 *  line this module is about to decide the shape of. */
const flatten = (line: string): string => untrailed(line.endsWith("\n") ? line.slice(0, -1) : line)

/**
 * WHERE EACH KEY'S ENTRY IS — the key's own line, through the last line that
 * belongs to it.
 *
 * {@link propsIn}'s walk read for a different question, and the difference is
 * what a key OWNS rather than what it says: a block list's items belong to the
 * key above them, and so does anything indented under it — a nested map this
 * reading refuses is still that key's to carry away when the key is replaced.
 * A blank line or a comment between two items belongs to the entry; trailing
 * ones after it do not, because they read as the space above the NEXT key.
 */
const entriesOf = (
  lines: ReadonlyArray<string>,
): ReadonlyArray<{ readonly key: string; readonly from: number; readonly to: number }> => {
  const found: Array<{ key: string; from: number; to: number }> = []
  for (let at = 0; at < lines.length; at++) {
    const flat = flatten(lines[at] as string)
    const text = flat.trimStart()
    if (text === "" || text.startsWith("#")) continue
    // An item or an indented line here belongs to a key already taken, or to
    // nothing at all — either way it is not the start of an entry.
    if (sequenceItem(text) !== null || flat !== text) continue
    const split = splitKey(text)
    if (split === null) continue
    let last = at
    for (let look = at + 1; look < lines.length; look++) {
      const next = flatten(lines[look] as string)
      const word = next.trimStart()
      if (word === "" || word.startsWith("#")) continue
      if (sequenceItem(word) === null && next === word) break
      last = look
    }
    found.push({ key: split[0], from: at, to: last })
    at = last
  }
  return found
}

/** ONE ENTRY, spelled — plain where this module's own reading hands that exact
 *  line back as that exact value, and double-quoted where it does not. The
 *  writer asks the reader rather than holding a second table of what YAML
 *  gives a meaning to. */
const spelled = (key: string, value: string): string => {
  const plainly = `${key}: ${value}`
  return propsIn(plainly)[key] === value ? plainly : `${key}: ${quotedValue(value)}`
}

/** A double-quoted scalar, with the two escapes {@link quoted} undoes and the
 *  two a line break would need. */
const quotedValue = (value: string): string =>
  `"${value.replace(/[\\"]/g, (one) => `\\${one}`).replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`

const SPACE = " ".charCodeAt(0)
const TAB = "\t".charCodeAt(0)
const RETURN = "\r".charCodeAt(0)

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
 * SPLIT rather than scanned, which is the opposite of what a reader of a
 * whole body does and is right here for the
 * reason scanning is right there: a body runs to every line of every
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
    const line = untrailed(raw)
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
 *  document as one written anywhere else. A walk back from the end rather than
 *  `/[ \t\r]+$/`, which retries from every position of a long run of blanks
 *  that is not at the end, and so is quadratic in a line somebody wrote. */
const untrailed = (line: string): string => {
  let end = line.length
  while (end > 0) {
    const code = line.charCodeAt(end - 1)
    if (code !== 0x20 && code !== 0x09 && code !== 0x0d) break
    end--
  }
  return end === line.length ? line : line.slice(0, end)
}

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
