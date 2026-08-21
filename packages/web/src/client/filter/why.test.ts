/**
 * Why a row is drawn, as the three things a filtered page says about it.
 *
 * Every number on a filtered page was already correct before this and the page
 * was still confusing (human, 2026-08-18, from one `#deferral` tag-click): a
 * row never said WHY it was in front of the reader. Three cases, and what is
 * pinned here is each one's answer —
 *
 *   1. a MATCH lights the words the query found it by, wherever they sit;
 *   2. a row kept only as the ancestry that leads to one is DIM, and says so
 *      through the same fact `data-match` already published;
 *   3. a row found ONLY behind its ¶ carries the words to excerpt, because its
 *      title holds nothing the reader typed.
 *
 * Over the reading `./narrowing.ts` produces rather than over a mock, so the
 * `matched` field these read is the matcher's own answer and not one invented
 * here.
 * The fixed-query note in `./narrowing.test.ts` applies unchanged: there is no
 * DOM under `bun test`, so each case builds its own reading.
 */

import { derive, litBy, parseFilter, rowsOf, type Shown } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Drawn, drawnBy } from "../page.ts"
import { excerptOf } from "../note/excerpt.ts"
import { answered } from "./answered.testlib.ts"
import { runsIn } from "./lit.ts"
import type { Narrowed } from "./narrowed.tsx"
import { asContext, behindTheMark, lighting } from "./why.ts"
import { createNarrowing } from "./narrowing.ts"

/** The shapes the three cases are made of: a title that MENTIONS a tag beside
 *  one that WEARS it, an ancestor carrying neither, and a note whose words are
 *  nowhere in the title above it. */
/** `order`'s note, named so the excerpt case can be about a POSITION in a
 *  string this file can point at rather than one it has to dig back out of a
 *  derivation. */
const NOTE =
  "Two ways to go: walnut, six weeks — or birch, in stock. Measure the alcove before ordering."

const derived = derive(nodesOfFiles({
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home","doing":true}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","desc":"${NOTE}"}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install the cabinets"}`,
    `{"id":"hinges","parent":"install","ord":"a0","title":"a hinge is filed under #home","todo":true}`,
  ].join("\n"),
}))

const TODAY = "2026-08-18"

const house: Shown = {
  kind: "outline",
  file: "house.olai",
  rows: rowsOf(derived, "house.olai"),
}
const tree: Drawn = drawnBy(house)

/** The page, at one query — with the answer the server would give
 *  (`./answered.testlib.ts`), because the `matched` field these three questions
 *  read has to be the matcher's rather than one invented here. */
const page = (text: string): Narrowed =>
  createRoot(() =>
    createNarrowing({
      query: () => parseFilter(text, TODAY),
      text: () => text,
      all: () => tree,
      visible: () => tree,
      matched: () => answered(derived, house, text, TODAY),
      answering: () => text.trim(),
    })
  )

test("a matched row is handed the query's words, and a kept ancestor is not", () => {
  const reading = page("cabinets")
  expect(lighting(reading, "order")).toEqual(["cabinets"])
  expect(lighting(reading, "install")).toEqual(["cabinets"])
  // The ancestry that leads there — drawn, and drawn as context.
  expect(lighting(reading, "kitchen")).toEqual([])
  expect(asContext(reading, "kitchen")).toBe(true)
  expect(asContext(reading, "order")).toBe(false)
})

test("an unfiltered page has no context and nothing to light", () => {
  // "Not a match" and "there is no query" are two different things, and the
  // dim is drawn on the second of them only.
  const reading = page("")
  expect(asContext(reading, "kitchen")).toBe(false)
  expect(lighting(reading, "order")).toEqual([])
})

test("a query with no words in it lights nothing on the rows it selects", () => {
  const reading = page("is:todo")
  expect(asContext(reading, "hinges")).toBe(false)
  expect(lighting(reading, "hinges")).toEqual([])
  expect(asContext(reading, "kitchen")).toBe(true)
})

test("a tag click lights the tag on the row that WEARS it, on both readings of it", () => {
  // The screenshot the ruling came from: one title merely talks about the tag
  // and the other carries it, and the format cannot tell use from mention —
  // so both are matches, and each says where the query landed.
  const reading = page("#home")
  expect(lighting(reading, "kitchen")).toEqual(["#home"])
  expect(lighting(reading, "hinges")).toEqual(["#home"])
  const title = "a hinge is filed under #home"
  expect(runsIn(title, litBy(title, lighting(reading, "hinges"))))
    .toEqual([
      { text: "a hinge is filed under ", lit: false },
      { text: "#home", lit: true },
    ])
})

test("a row found only behind its ¶ carries the words to excerpt", () => {
  // `alcove` is in the note and nowhere in the title, so the row draws a title
  // holding nothing the reader typed — which is the whole reason for the line.
  const reading = page("alcove")
  expect(behindTheMark(reading, "order")).toEqual(["alcove"])
  // ...and every other row does not: the ancestry above it has no note at all,
  // and a row whose TITLE says it needs no second line saying it again.
  expect(behindTheMark(reading, "kitchen")).toEqual([])
  expect(behindTheMark(page("cabinets"), "order")).toEqual([])
  expect(behindTheMark(page("cabinets alcove"), "order")).toEqual([])
})

test("the excerpt is a window on the hit, one line, with the word lit in it", () => {
  const runs = excerptOf(NOTE, ["alcove"])
  expect(runs).toBeDefined()
  const said = (runs ?? []).map((run) => run.text).join("")
  expect(said).toContain("Measure the alcove before ordering.")
  expect(said).not.toContain("\n")
  expect((runs ?? []).filter((run) => run.lit).map((run) => run.text))
    .toEqual(["alcove"])
  // It opened somewhere other than the top of the note, and says so.
  expect(said.startsWith("…")).toBe(true)
})

test("the marks around a word survive the cut, because they are what the note says", () => {
  // The excerpt is a POSITION in a note, not an opening (./preview.ts is the
  // opening, and tidies). Stripping `**` would move every offset after it away
  // from where the matcher found the hit — so the marks stay, and the word is
  // lit INSIDE them (grok, #240, asking for this pinned rather than argued).
  const runs = excerptOf("- **walnut** — six week lead time", ["walnut"]) ?? []
  expect(runs.map((run) => run.text).join("")).toBe(
    "- **walnut** — six week lead time",
  )
  expect(runs).toEqual([
    { text: "- **", lit: false },
    { text: "walnut", lit: true },
    { text: "** — six week lead time", lit: false },
  ])
})

test("a note the query is not in has no excerpt to draw", () => {
  expect(excerptOf("Two ways to go: walnut or birch.", ["alcove"])).toBeUndefined()
  expect(excerptOf("", ["alcove"])).toBeUndefined()
  expect(excerptOf("Two ways to go", [])).toBeUndefined()
})

test("the window opens on the hit's own LINE, not a fixed count back", () => {
  // A note is written in lines: the sentence a word is in begins where its
  // paragraph or its list item does, and a window that opened forty characters
  // back instead would start halfway through the item above.
  const runs = excerptOf(
    "Two ways to go:\n\n- **walnut** — six week lead time\n- *birch* — in stock today\n\nMeasure the alcove before ordering.",
    ["alcove"],
  ) ?? []
  expect(runs.map((run) => run.text).join("")).toBe(
    "…Measure the alcove before ordering.",
  )
})

test("a short note is its own excerpt, with no marks pretending it was cut", () => {
  const runs = excerptOf("walnut or birch", ["birch"]) ?? []
  expect(runs.map((run) => run.text).join("")).toBe("walnut or birch")
  expect(runs).toEqual([
    { text: "walnut or ", lit: false },
    { text: "birch", lit: true },
  ])
})
