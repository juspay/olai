import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { plainTitle } from "./plain.ts"
import { hastToHtml, renderToTree } from "./render.ts"
import { styleTags, TAG_CLASS } from "./tags.ts"
import { tagStyle } from "@olai/appearance/tagInk.ts"

installPipeline(pipeline)

const NOTE = "house.olai"

const viaPipeline = (
  title: string,
  needles: ReadonlyArray<string> = [],
): string => {
  const tree = renderToTree(TEST_CLAIMS, title, NOTE, "inline")
  styleTags(tree, needles)
  return hastToHtml(tree)
}

const NEEDLES = ["a", "the", "#", "1", "b9"]

const REAL = [
  "sow the basil",
  "kitchen remodel #home",
  "garden #outdoors",
  "the herb bed by the door",
  "Roadmap initial load feels very slow",
  "First snapshot carries every document body — must scale to 1000s of .md files",
  "Upstream: buildSurfaceClient should emit precompressed siblings #upstream",
  "order the new cabinets",
  "Ship #93 and #95, then #113",
  "a/b testing #eng/perf",
  "why not? because 100% of the time, it works 60% of the time",
  "Bug: “smart quotes” and an em—dash",
  "café, naïve, jalapeño",
  "日本語のタイトル",
  "1000s of files",
  "v1.2.3 released",
  "buy milk, eggs, and 2 apples",
  "TODO tomorrow",
  "#home",
  "#a-b/c",
  'the "quoted" one',
  "spaces   in   the   middle",
  "trailing punctuation!!",
  "fix the sink (again)",
]

test("every title this app really draws takes the fast path", () => {
  for (const title of REAL) {
    expect(plainTitle(title), title).not.toBeNull()
  }
})

test("what the fast path writes is what the pipeline writes", () => {
  for (const title of REAL) expect(plainTitle(title), title).toBe(viaPipeline(title))
})

test("...and the same is true with the query's words lit in them", () => {
  for (const title of REAL) {
    expect(plainTitle(title, NEEDLES), title).toBe(viaPipeline(title, NEEDLES))
  }
})

test("a needle in a title is wrapped where it sits, on both paths", () => {
  const html = plainTitle("order the new cabinets", ["cabinets"])
  expect(html).toBe(
    `order the new <mark class="olai-hit" data-testid="hit">cabinets</mark>`,
  )
  expect(html).toBe(viaPipeline("order the new cabinets", ["cabinets"]))
})

test("a needle inside a TAG is lit inside the pill, not instead of it", () => {
  const html = plainTitle("kitchen remodel #home", ["#home"])
  expect(html).toContain(`data-tag="#home"`)
  expect(html).toContain(`<mark class="olai-hit" data-testid="hit">#home</mark>`)
  expect(html).toBe(viaPipeline("kitchen remodel #home", ["#home"]))
  expect(plainTitle("kitchen remodel #home", ["home"]))
    .toContain(`#<mark class="olai-hit" data-testid="hit">home</mark>`)
})

test("a phrase that spans a tag boundary lights across it, on both paths", () => {
  const html = plainTitle("kitchen remodel #home", ["remodel #home"])
  expect(html).toBe(viaPipeline("kitchen remodel #home", ["remodel #home"]))
  expect(html).toContain(`data-tag="#home"`)
  expect(html).toBe(
    `kitchen <mark class="olai-hit" data-testid="hit">remodel </mark>` +
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home" style="${
        tagStyle("#home")
      }">` +
      `<mark class="olai-hit" data-testid="hit">#home</mark></span>`,
  )
})

test("a title the query is not in is written exactly as it was without one", () => {
  for (const title of REAL) {
    expect(plainTitle(title, ["zzzz"]), title).toBe(plainTitle(title))
  }
})

test.each([
  ["**bold**", "emphasis"],
  ["_under_", "emphasis"],
  ["a *b* c", "emphasis mid-line"],
  ["`code`", "code span"],
  ["[label](/x)", "link"],
  ["![picture](/x.png)", "image"],
  ["<b>raw</b>", "raw HTML"],
  ["<https://example.com>", "autolink"],
  ["A &amp; B", "entity"],
  ["a \\* b", "escape"],
  ["#a_b", "an underscore in a tag is still an underscore"],
  ["~~struck~~", "strikethrough"],
  ["a | b", "table cell"],
  ["# heading", "ATX heading"],
  ["###### heading", "ATX heading"],
  ["#", "a bare hash is not a tag"],
  ["# ", "heading with nothing in it"],
  ["- item", "list item"],
  ["+ item", "list item"],
  ["1. item", "ordered item"],
  ["12) item", "ordered item"],
  ["> quoted", "block quote"],
  ["---", "thematic break"],
  ["===", "setext rule"],
  [" leading", "the parser drops it"],
  ["trailing ", "the parser drops it"],
  ["two\nlines", "two blocks"],
  ["a\tb", "a tab can be indentation"],
  ["", "nothing to draw"],
  ["see https://example.com", "GFM autolink literal"],
  ["see www.example.com", "GFM autolink literal"],
  ["mail me at bob@example.com", "GFM email autolink"],
  ["mailto:bob@example.com", "GFM autolink literal"],
])("the fast path refuses %j (%s)", (title) => {
  expect(plainTitle(title)).toBeNull()
})

test("a tag on the fast path is the same pill the pipeline draws", () => {
  const html = plainTitle("kitchen remodel #home")
  expect(html).toContain(">#home</span>")
  expect(html).toBe(viaPipeline("kitchen remodel #home"))
  expect(html).not.toBe("kitchen remodel #home")
})

const ALPHABET = [
  ..."ab19 ",
  ..."*_`[]()<>&\\~|!#-+.:/@=",
  '"',
  "'",
]

test("anything the fast path accepts renders the same as the pipeline", () => {
  let accepted = 0
  const check = (title: string): void => {
    const fast = plainTitle(title)
    if (fast === null) {
      expect(plainTitle(title, NEEDLES), title).toBeNull()
      return
    }
    accepted++
    expect(fast, title).toBe(viaPipeline(title))
    expect(plainTitle(title, NEEDLES), title).toBe(viaPipeline(title, NEEDLES))
  }

  for (const one of ALPHABET) {
    check(one)
    for (const two of ALPHABET) check(one + two)
  }

  let seed = 0x5f3759df
  const next = (bound: number): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % bound
  }
  for (let sample = 0; sample < 600; sample++) {
    let title = ""
    const length = 3 + next(10)
    for (let at = 0; at < length; at++) title += ALPHABET[next(ALPHABET.length)]
    check(title)
  }

  expect(accepted).toBeGreaterThan(100)
})
