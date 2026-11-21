/**
 * TEXT TO TREE — the one Markdown parse this app makes, for the page and,
 * from a later stage of this package, for every other reader of text.
 *
 * `remark-parse` with `remark-gfm` and Obsidian's wikilinks and spaced
 * addresses (`./obsidian.ts`): CommonMark and GitHub's dialect, which is
 * what brings footnotes, tables, task lists and strikethrough into the same
 * dialect an agent and a reader already write. These are the options the
 * page has always rendered with; `@olai/markdown-ui`'s pipeline starts from
 * the tree this makes and draws it.
 *
 * NO FRONTMATTER here: a `---` block is a FILE's own record and is taken off
 * by the caller that knows its text is a whole file (`./frontmatter.ts`'s
 * `proseIn`). A note under a row is not a file, and a leading `---` in one is
 * the thematic break Markdown says it is.
 *
 * Its own module, and nothing first-paint imports it: the parser is ~150 KB
 * of the client, and the tag grammar (`./tags.ts`) and the plain-title test
 * (`./plain.ts`) are needed before it has loaded.
 */
import type { Root } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { type Processor, unified } from "unified"

import { obsidianFromMarkdown, obsidianSyntax } from "./obsidian.ts"

/** `./obsidian.ts`'s two halves, attached the way `remark-gfm` attaches its
 *  own: after it, so a spaced address is tried before a footnote's `]`. */
function remarkObsidian(this: Processor): void {
  const data = this.data()
  ;(data.micromarkExtensions ??= []).push(obsidianSyntax)
  ;(data.fromMarkdownExtensions ??= []).push(obsidianFromMarkdown)
}

/** Built once, on the first parse: attaching the extensions is work a parse
 *  per text must not repeat, and building it lazily leaves this module with
 *  nothing to run at import, so a bundle that imports `@olai/format` for a
 *  rule and never parses carries no parser. */
let parser: ReturnType<typeof dialect> | undefined
const dialect = () => unified().use(remarkParse).use(remarkGfm).use(remarkObsidian).freeze()

/** The Markdown tree of a text, in the dialect this app reads. */
export const parse = (text: string): Root => (parser ??= dialect()).parse(text)

/**
 * THE FOUR SHAPES THE PARSER IS NOT LINEAR ON, measured in one pass over the
 * text, before it is parsed. A text is olai's to read but not olai's to
 * trust: a note pasted in, or written by an agent, can be any shape at all,
 * and the parser's cost on these four grows faster than the text does —
 * thousands of repeats take seconds, and the deepest nesting throws.
 *
 *   - `emphasis`: the longest run of one emphasis mark, `*` or `_`;
 *   - `cells`: the most cells a line's `|`s could make;
 *   - `quotes`: the deepest run of `>` opening a line;
 *   - `lists`: the deepest list a line could open — its indent, two columns a
 *     level, and the list markers it opens with.
 */
export interface Shape {
  readonly emphasis: number
  readonly cells: number
  readonly quotes: number
  readonly lists: number
}

const STAR = 42
const UNDERSCORE = 95
const BAR = 124
const GREATER = 62
const SPACE = 32
const TAB = 9
const NEWLINE = 10

export const shapeOf = (text: string): Shape => {
  let emphasis = 0
  let cells = 0
  let quotes = 0
  let lists = 0
  let run = 0
  let mark = -1
  let at = 0
  while (at <= text.length) {
    const end = text.indexOf("\n", at)
    const stop = end === -1 ? text.length : end
    // The line's opening: indent, `>`s, then list markers.
    let column = 0
    let cursor = at
    let depth = 0
    for (; cursor < stop; cursor++) {
      const code = text.charCodeAt(cursor)
      if (code === SPACE) column++
      else if (code === TAB) column += 4
      else if (code === GREATER) depth++
      else break
    }
    if (depth > quotes) quotes = depth
    let markers = 0
    for (;;) {
      const after = markerEnd(text, cursor, stop)
      if (after === -1) break
      markers++
      cursor = after
      while (cursor < stop && (text.charCodeAt(cursor) === SPACE || text.charCodeAt(cursor) === TAB)) cursor++
    }
    if (markers > 0 && Math.floor(column / 2) + markers > lists) lists = Math.floor(column / 2) + markers
    // The line's runs of emphasis marks and its bars.
    let bars = 0
    for (let index = at; index < stop; index++) {
      const code = text.charCodeAt(index)
      if (code === STAR || code === UNDERSCORE) {
        run = code === mark ? run + 1 : 1
        mark = code
        if (run > emphasis) emphasis = run
      } else {
        mark = -1
        if (code === BAR) bars++
      }
    }
    if (bars + 1 > cells) cells = bars + 1
    mark = -1
    at = stop + 1
  }
  return { emphasis, cells, quotes, lists }
}

/** Where a list marker that starts at `at` ends — `-`, `*`, `+`, or a number
 *  and `.` or `)`, followed by a space or the line's end — or `-1`. */
const markerEnd = (text: string, at: number, stop: number): number => {
  if (at >= stop) return -1
  const code = text.charCodeAt(at)
  let after = -1
  if (code === 45 || code === STAR || code === 43) after = at + 1
  else {
    let digit = at
    while (digit < stop && digit - at < 9 && text.charCodeAt(digit) >= 48 && text.charCodeAt(digit) <= 57) digit++
    if (digit > at && digit < stop && (text.charCodeAt(digit) === 46 || text.charCodeAt(digit) === 41)) after = digit + 1
  }
  if (after === -1) return -1
  if (after === stop) return after
  const next = text.charCodeAt(after)
  return next === SPACE || next === TAB || next === NEWLINE ? after : -1
}

/**
 * THE BOUNDS a text's shape may reach and still be parsed, each at least ten
 * times the largest value any note, row or docs page in this repository
 * reaches, so no real note is refused, and each low enough that a text AT it
 * parses in well under 50 ms. `./parse.bench.ts` prints both — the largest
 * values the repository's texts reach, and each hostile shape timed at its
 * bound — and `./read.test.ts` holds that no real text is refused.
 *
 * Measured when these were set: the repository's texts reach an emphasis run
 * of 3, 7 cells, 3 quotes and a list 5 deep; at these bounds the four shapes
 * parse in about 4, 9, 3 and 25 ms. The list is the steep one — 100 deep is
 * about 54 ms and 200 deep half a second — which is why its bound is the
 * tightest.
 */
export const BOUNDS: Shape = { emphasis: 100, cells: 100, quotes: 100, lists: 50 }

/** Why a text was not parsed: the shape that passed its bound, or the
 *  parser's own failure. */
export type Refusal = keyof Shape | "error"

/** The tree of a text, or why there is none. */
export type Guarded =
  | { readonly tree: Root; readonly refused?: undefined }
  | { readonly tree?: undefined; readonly refused: Refusal }

/**
 * The parse, guarded: a text whose shape passes a bound is refused without
 * being parsed, and a throw from the parser is caught — either way the
 * answer says so, and the reader of it reads the text as plain words. The
 * page and the index ask this one function, so they refuse the same texts.
 */
export const guarded = (text: string): Guarded => {
  const shape = shapeOf(text)
  for (const key of SHAPES) if (shape[key] > BOUNDS[key]) return { refused: key }
  try {
    return { tree: parse(text) }
  } catch {
    return { refused: "error" }
  }
}

const SHAPES: ReadonlyArray<keyof Shape> = ["emphasis", "cells", "quotes", "lists"]
