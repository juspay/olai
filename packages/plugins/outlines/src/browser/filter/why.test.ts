import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, litBy, parseFilter, rowsOf, type Shown } from "@olai/format"
import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Drawn, drawnBy } from "../page.ts"
import { excerptOf } from "../note/excerpt.ts"
import { answered } from "./answered.testlib.ts"
import { runsIn } from "@olai/markdown-ui/lit.ts"
import type { Narrowed } from "./narrowed.tsx"
import { asContext, behindTheMark, lighting } from "./why.ts"
import { createNarrowing } from "./narrowing.ts"

const NOTE =
  "Two ways to go: walnut, six weeks — or birch, in stock. Measure the alcove before ordering."

const derived = derive(TEST_CLAIMS, nodesOfFiles({
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
  expect(lighting(reading, "kitchen")).toEqual([])
  expect(asContext(reading, "kitchen")).toBe(true)
  expect(asContext(reading, "order")).toBe(false)
})

test("an unfiltered page has no context and nothing to light", () => {
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
  const reading = page("alcove")
  expect(behindTheMark(reading, "order")).toEqual(["alcove"])
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
  expect(said.startsWith("…")).toBe(true)
})

test("the marks around a word survive the cut, because they are what the note says", () => {
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
