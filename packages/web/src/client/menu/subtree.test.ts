/**
 * What the menu puts on the clipboard when it copies a subtree.
 *
 * Over REAL rows: the fixture goes through `@olai/format`'s own assembly and
 * walk, because the answer turns on how a mirror is expanded and a hand-built
 * row would be this file's opinion of that rather than the format's.
 *
 * ITS SIBLING CLAIM IS PINNED ELSEWHERE. How MUCH an archive would move is a
 * count over the SET, and it rides on the row now (`Row.under`), so it is
 * asserted where it is produced — `@olai/format`'s `derive.test.ts`, including
 * the case that decides the split: hiding what is done must not shrink it.
 */

import { derive, rowsOf, type Row } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { flatten } from "../edit/order.ts"
import { asText } from "./subtree.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the old counters","done":"2026-08-03"}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the **walnut** cabinets","date":"2026-08-10","desc":"Two ways to go:\\n\\n- walnut, six weeks\\n- birch, in stock"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
  `{"id":"handles","parent":"install","ord":"a0","title":"choose the handles"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  `{"id":"lost","ord":"a1","mirror":"nothing-declares-this"}`,
].join("\n")

const GARDEN = [
  `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
  `{"id":"basil","parent":"herbs","ord":"a0","title":"sow the basil"}`,
].join("\n")

const derived = derive(recordsOf(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })))
const rows = rowsOf(derived, "house.olai")

/** One row of the fixture, by id. `flatten` with nothing folded is "every row
 *  there is" — the client's own walk (`edit/order.ts`), rather than a second
 *  one written here to disagree with it about what pre-order means. */
const row = (id: string, of: ReadonlyArray<Row> = rows): Row => {
  const found = flatten(of, new Set()).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

// ── what it reads as ───────────────────────────────────────────────────

test("a subtree is tabs, titles verbatim, and the note one level deeper", () => {
  expect(asText(row("kitchen"))).toBe(
    [
      "kitchen remodel",
      "\ttake out the old counters",
      // The title as the record HOLDS it: the page renders `**walnut**` bold,
      // and a copy that pasted the rendering would throw away what was typed.
      "\torder the **walnut** cabinets",
      "\t\tTwo ways to go:",
      // A blank line inside a note stays blank rather than becoming a line of
      // trailing tabs.
      "",
      "\t\t- walnut, six weeks",
      "\t\t- birch, in stock",
      "\tinstall them",
      "\t\tchoose the handles",
      // The mirror is copied as what it DRAWS — its target's title and its
      // target's children — because that is what the reader is looking at.
      "\tthe herb bed",
      "\t\tsow the basil",
    ].join("\n"),
  )
})

test("nothing about a mark or a date is encoded", () => {
  const text = asText(row("kitchen"))
  expect(text).not.toContain("2026-08-03")
  expect(text).not.toContain("2026-08-10")
  expect(text).not.toContain("done")
})

test("one node with no note is one line", () => {
  expect(asText(row("handles"))).toBe("choose the handles")
})

test("a placement that draws no node copies nothing", () => {
  // Its row says, in words, that the node it names is missing — and those
  // words are the tree's, not a line of somebody's outline.
  expect(asText(row("lost"))).toBe("")
})
