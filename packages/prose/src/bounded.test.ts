/**
 * THE BOUNDS THE PARSE KEEPS (`./bounded.ts`): no ordinary note is touched by
 * them, every shape they hold parses in time that grows with its length, and
 * past each limit the shape is read as words rather than refused.
 */
import { expect, test } from "bun:test"

import type { Nodes, Root } from "mdast"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

import { LIMITS } from "./bounded.ts"
import { HOSTILE, realTexts } from "./corpus.testlib.ts"
import { remarkObsidian } from "./obsidian.ts"
import { guarded, parse } from "./parse.ts"
import { read } from "./read.ts"

/** The same dialect with no bounds — what the bounds are held equal to. */
const unbounded = unified().use(remarkParse).use(remarkGfm).use(remarkObsidian).freeze()

const kinds = (tree: Root): ReadonlyArray<string> => tree.children.map((one) => one.type)

const count = (node: Nodes, type: string): number =>
  (node.type === type ? 1 : 0) + ("children" in node ? node.children.reduce((sum, child) => sum + count(child, type), 0) : 0)

/** How deep blocks of one type nest. */
const depth = (node: Nodes, type: string): number =>
  (node.type === type ? 1 : 0) + ("children" in node ? Math.max(0, ...node.children.map((child) => depth(child, type))) : 0)

/** The four notes an earlier guard, counting marks before the parse, refused:
 *  each shape sits in code or is a rule, where no bound reaches. */
const ORDINARY: Readonly<Record<string, readonly [text: string, kinds: ReadonlyArray<string>]>> = {
  "a code block with a C banner of 120 stars": [
    "Before\n\n```c\n/" + "*".repeat(120) + "\n * the porch light\n " + "*".repeat(120) + "/\n```\n\nAfter",
    ["paragraph", "code", "paragraph"],
  ],
  "a rule of 101 underscores between paragraphs": [
    "One paragraph.\n\n" + "_".repeat(101) + "\n\nAnother paragraph.",
    ["paragraph", "thematicBreak", "paragraph"],
  ],
  "a code block with a dash line indented 100 columns": [
    "Notes\n\n```\n" + " ".repeat(100) + "- a dash far in\n```\n",
    ["paragraph", "code"],
  ],
  "a code block with a shell line of 100 pipes": ["Run this:\n\n```sh\necho " + "|".repeat(100) + "\n```\n", ["paragraph", "code"]],
}

for (const [what, [text, expected]] of Object.entries(ORDINARY)) {
  test(`${what} parses as itself`, () => {
    expect(guarded(text).refused).toBeUndefined()
    expect(kinds(parse(text))).toEqual(expected)
    expect(read(text).refused).toBeUndefined()
  })
}

test("no note, row or docs page in this repository reaches a bound: each parses as it would with none", () => {
  const texts = realTexts()
  expect(texts.length).toBeGreaterThan(200)
  const differing = texts.filter((one) => !Bun.deepEquals(parse(one.text), unbounded.parse(one.text))).map((one) => one.from)
  expect(differing).toEqual([])
})

test("emphasis: a run at the limit is emphasis, a longer one is words", () => {
  expect(count(parse(HOSTILE.emphasis(LIMITS.run)), "strong")).toBeGreaterThan(0)
  const past = parse(HOSTILE.emphasis(LIMITS.run + 1))
  expect([count(past, "strong"), count(past, "emphasis")]).toEqual([0, 0])
  expect(read(HOSTILE.emphasis(LIMITS.run + 1)).words).toBe(HOSTILE.emphasis(LIMITS.run + 1))
})

test("table: a row of the most cells is a table, a wider one is not", () => {
  // A row's outer bars make one more bar than the cells it draws.
  expect(count(parse(HOSTILE.cells(LIMITS.cells - 1)), "table")).toBe(1)
  expect(count(parse(HOSTILE.cells(LIMITS.cells + 1)), "table")).toBe(0)
})

test("containers: a quote or a list nests until the column, and the rest is words", () => {
  const quotes = parse(HOSTILE.quotes(20_000))
  expect(depth(quotes, "blockquote")).toBe(LIMITS.column)
  expect(read(HOSTILE.quotes(20_000)).refused).toBeUndefined()
  // Two columns a level.
  expect(depth(parse(HOSTILE.lists(200)), "list")).toBeLessThanOrEqual(LIMITS.column / 2)
  expect(depth(parse(HOSTILE.lists(40)), "list")).toBe(40)
})

/** Each bounded shape, at a size well past its limit and eight times that:
 *  linear work is about eight times the time, the square sixty-four. The
 *  emphasis is written in `*`: a long run of `_` also meets GitHub's bare
 *  e-mail address reader, whose cost on it is its own and not one of these
 *  bounds. */
test("past its limit, each shape parses in time that grows with its length", () => {
  const stars = (n: number): string => "*".repeat(n) + "word" + "*".repeat(n)
  const shapes: ReadonlyArray<readonly [string, (n: number) => string]> = [
    ["emphasis", stars],
    ["cells", HOSTILE.cells],
    ["quotes", HOSTILE.quotes],
    ["many runs at the limit", (n) => stars(LIMITS.run).concat(" ").repeat(n / LIMITS.run)],
  ]
  for (const [what, shape] of shapes) {
    const time = (n: number): number => {
      const text = shape(n)
      const started = performance.now()
      parse(text)
      return performance.now() - started
    }
    time(500)
    const small = Math.max(Math.min(time(1_000), time(1_000)), 1)
    const large = Math.min(time(8_000), time(8_000))
    expect({ what, linear: large / small < 30 }).toEqual({ what, linear: true })
  }
})
