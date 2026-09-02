/**
 * The section's arithmetic: one reading of what refers to a node, and the rows
 * it is drawn as.
 *
 * What COUNTS as a reference is `@olai/format`'s (`backlinks.test.ts` holds the
 * four rulings); what is asserted here is the shape the client needs — a record
 * doing both things appearing in both rows, and the count being records rather
 * than links, because that number is the whole of what a shut section says.
 *
 * WHO REFERS is the page's own reading now — the server walks it with the same
 * `backlinksOf` and sends it with the node page (`@olai/format`'s `page.ts`) —
 * so this file calls that function directly, which is exactly what the browser
 * is handed. What is asserted is still the client's half: the shaping into rows,
 * and the count a shut section says out loud.
 */

import { backlinksOf, derive } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { rowsOf } from "./refs.ts"

const viewOf = (files: Record<string, string>) => derive(recordsOf(setOf(files)))

/** What refers to `id`, exactly as a node page's reading carries it. */
const referringTo = (files: Record<string, string>, id: string) =>
  backlinksOf(viewOf(files), id)

const HOUSE = {
  "house.org": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","see":["herbs"]}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","desc":"after @herbs is in"}`,
    `{"id":"both","parent":"kitchen","ord":"a3","title":"water @herbs","see":["herbs"]}`,
  ].join("\n"),
  "garden.org": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
}

test("the rows are keyed by the way, and a record doing both is in each", () => {
  const rows = rowsOf(referringTo(HOUSE, "herbs"))
  expect(rows.see.map((ref) => ref.id)).toEqual(["order", "both"])
  expect(rows.mention.map((ref) => ref.id)).toEqual(["install", "both"])
})

test("the count is the RECORDS referring, not the links they are drawn as", () => {
  // THREE, not four: `both` points and mentions, and it is one thing referring.
  // This is the number the shut section says out loud.
  expect(referringTo(HOUSE, "herbs")).toHaveLength(3)
})

test("a link carries the referrer's own title and the outline it is written in", () => {
  // Read off the record rather than resolved again: this list is already
  // records, so nothing here can disagree with the page the link opens.
  expect(rowsOf(referringTo(HOUSE, "herbs")).see[0]).toEqual({
    id: "order",
    title: "order the cabinets",
    from: "house.org",
  })
})

test("a node nothing refers to draws nothing", () => {
  expect(referringTo(HOUSE, "kitchen")).toEqual([])
})
