import { TEST_CLAIMS } from "@olai/format/testlib"
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

const derived = derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })))
const rows = rowsOf(derived, "house.olai")

const row = (id: string, of: ReadonlyArray<Row> = rows): Row => {
  const found = flatten(of, new Set()).find((one) => one.at.node.id === id)
  if (found === undefined) throw new Error(`no row for \`${id}\` in the fixture`)
  return found
}

test("a subtree is tabs, titles verbatim, and the note one level deeper", () => {
  expect(asText(row("kitchen"))).toBe(
    [
      "kitchen remodel",
      "\ttake out the old counters",
      "\torder the **walnut** cabinets",
      "\t\tTwo ways to go:",
      "",
      "\t\t- walnut, six weeks",
      "\t\t- birch, in stock",
      "\tinstall them",
      "\t\tchoose the handles",
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
  expect(asText(row("lost"))).toBe("")
})
