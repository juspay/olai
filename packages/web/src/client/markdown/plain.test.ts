/**
 * The fast path is only allowed to be fast if it is also RIGHT.
 *
 * ./plain.ts answers a title without the markdown pipeline, which is what lets
 * an outline paint before ~391 KB of parser has been fetched. The claim it
 * makes is narrow and total: for every title it accepts, what it writes is
 * byte for byte what the pipeline would have written. So that is what is
 * tested — both ways round, because the two failures are not the same failure:
 *
 *   - accepting a title it should not have is a page that draws somebody's
 *     `**word**` with its asterisks forever, and no fetch would ever fix it;
 *   - refusing one it could have answered costs a fetch the page was capable
 *     of making anyway.
 *
 * Hence the sweep below: every string it accepts is rendered both ways and the
 * two must agree. The refusals are spot-checked by construct — a list of what
 * markdown can do to a line, which is the same list ./plain.ts is written
 * against.
 */

import { expect, test } from "bun:test"

import { installPipeline } from "./chunk.ts"
import * as pipeline from "./pipeline.ts"
import { plainTitle } from "./plain.ts"
import { hastToHtml, renderToTree } from "./render.ts"
import { styleTags, TAG_CLASS } from "./tags.ts"

installPipeline(pipeline)

const NOTE = "house.olai"

/**
 * The long way round: the pipeline, forced inline, then the tag split — which
 * is what ./title.ts does for a title the fast path refused.
 *
 * The loss fallback that follows it there is deliberately not repeated: it
 * fires when the rendering has LESS text than the source, and a title with no
 * markdown in it renders as its own words, so it cannot fire on anything this
 * file is about. The sweep would catch it if that stopped being true — the
 * fallback's output is escaped source, which is not what a tag renders as.
 */
const viaPipeline = (
  title: string,
  needles: ReadonlyArray<string> = [],
): string => {
  const tree = renderToTree(title, NOTE, "inline")
  styleTags(tree, needles)
  return hastToHtml(tree)
}

/**
 * A filter's words, for the half of this sweep that is about the HIGHLIGHT.
 *
 * A filtered row lights the query's words where they sit (`../filter/lit.ts`),
 * and it has to do it on both paths — a page that highlighted the fast titles
 * and not the ones with markdown in them would miss exactly the rows a reader
 * is least able to explain to themselves. So the claim this file makes is made
 * twice: with no query, and with one.
 *
 * These are chosen to LAND, on the alphabet below as well as on the real
 * titles: a sweep whose needles were never in anything would prove that two
 * paths agree about doing nothing.
 */
const NEEDLES = ["a", "the", "#", "1", "b9"]

/** Titles this app actually draws: this repository's own roadmap, the test
 *  corpus, and the shapes a person types into an outline. */
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
    // `!!` is an exclamation mark, which markdown only uses in front of a `[`.
    // If a real title starts being refused, that is a rule that has become too
    // wide, and the number this whole change is about gets worse.
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
  // The gesture this whole feature was ruled from: `#deferral` pressed, and a
  // page that lit every word but the one the reader clicked.
  const html = plainTitle("kitchen remodel #home", ["#home"])
  expect(html).toContain(`data-tag="#home"`)
  expect(html).toContain(`<mark class="olai-hit" data-testid="hit">#home</mark>`)
  expect(html).toBe(viaPipeline("kitchen remodel #home", ["#home"]))
  // The BARE spelling finds the same tag — the fold indexes it twice — and
  // lights the name without the sigil, which is what the query asked for.
  expect(plainTitle("kitchen remodel #home", ["home"]))
    .toContain(`#<mark class="olai-hit" data-testid="hit">home</mark>`)
})

test("a phrase that spans a tag boundary lights across it, on both paths", () => {
  // The query is looked for ONCE over the whole title and the parts are windows
  // onto what it found. Searched per part instead, `remodel #home` is inside
  // neither the text part nor the tag part — the row matched and lit nothing,
  // which is the exact confusion this feature exists to end (grok, #240).
  const html = plainTitle("kitchen remodel #home", ["remodel #home"])
  expect(html).toBe(viaPipeline("kitchen remodel #home", ["remodel #home"]))
  // The pill is still a pill: the mark opens in the text and closes inside the
  // span, because the tag's own markup is not something a highlight may span.
  expect(html).toContain(`data-tag="#home"`)
  expect(html).toBe(
    `kitchen <mark class="olai-hit" data-testid="hit">remodel </mark>` +
      `<span class="${TAG_CLASS}" data-testid="tag" data-tag="#home">` +
      `<mark class="olai-hit" data-testid="hit">#home</mark></span>`,
  )
})

test("a title the query is not in is written exactly as it was without one", () => {
  for (const title of REAL) {
    expect(plainTitle(title, ["zzzz"]), title).toBe(plainTitle(title))
  }
})

/**
 * Everything markdown can do to one line, each as the reason the fast path
 * must not touch it. Refusal is `null` — "ask the pipeline".
 */
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
  // Not the escaped-source fallback wearing a pill's clothes.
  expect(html).not.toBe("kitchen remodel #home")
})

/**
 * The sweep. Every string built out of the alphabet below is put to
 * ./plain.ts, and every one it ACCEPTS has to render identically both ways.
 *
 * The alphabet is words and whitespace plus every character markdown gives a
 * meaning to, so the strings that come out are exactly the near misses a
 * hand-written list would not think of (`a#b`, `1.x`, `-a`, `a  #b#`). Short
 * exhaustive first, then a deterministic sample of longer ones — deterministic
 * because a test that fails one run in fifty is a test nobody believes.
 */
const ALPHABET = [
  ..."ab19 ",
  ..."*_`[]()<>&\\~|!#-+.:/@=",
  '"',
  "'",
]

test("anything the fast path accepts renders the same as the pipeline", () => {
  let accepted = 0
  // BOTH READINGS of every accepted title: as the page draws it, and as a
  // filtered page draws it. The highlight is a wrapper around text that was
  // going to be written either way, so what is refused does not move — which
  // is itself part of the claim, since a fast path that answered a different
  // set of titles under a query would be two rules pretending to be one.
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

  // A 32-bit LCG, so the same 600 strings are swept on every machine.
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

  // The sweep is only evidence if it accepted things. (Roughly a third of the
  // two-character strings are plain, so this is a floor, not a target.)
  expect(accepted).toBeGreaterThan(100)
})
