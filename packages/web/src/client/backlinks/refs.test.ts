/**
 * The section's arithmetic: one reading of what refers to a node, and the rows
 * it is drawn as.
 *
 * What COUNTS as a reference is `@olai/format`'s (`backlinks.test.ts` holds the
 * four rulings); what is asserted here is the shape the client needs — a record
 * doing both things appearing in both rows, and the count being records rather
 * than links, because that number is the whole of what a shut section says.
 *
 * The count and the rows are two calls, and the test asks them that way: the
 * rows are built only once a reader has opened the section (`./Backlinks.tsx`),
 * so a suite that could only get the count out of the same call as the rows
 * would be pinning a shape the component had already stopped using.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { referringTo, rowsOf } from "./refs.ts"

const viewOf = (files: Record<string, string>) => derive(setOf(files).nodes)

const HOUSE = {
  "house.olai": [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","see":["herbs"]}`,
    `{"id":"install","parent":"kitchen","ord":"a2","title":"install them","desc":"after @herbs is in"}`,
    `{"id":"both","parent":"kitchen","ord":"a3","title":"water @herbs","see":["herbs"]}`,
  ].join("\n"),
  "garden.olai": `{"id":"herbs","ord":"a0","title":"the herb bed"}`,
}

test("the rows are keyed by the way, and a record doing both is in each", () => {
  const rows = rowsOf(referringTo(viewOf(HOUSE), "herbs"))
  expect(rows.see.map((ref) => ref.id)).toEqual(["order", "both"])
  expect(rows.mention.map((ref) => ref.id)).toEqual(["install", "both"])
})

test("the count is the RECORDS referring, not the links they are drawn as", () => {
  // THREE, not four: `both` points and mentions, and it is one thing referring.
  // This is the number the shut section says out loud.
  expect(referringTo(viewOf(HOUSE), "herbs")).toHaveLength(3)
})

test("a link carries the referrer's own title and the outline it is written in", () => {
  // Read off the record rather than resolved again: this list is already
  // records, so nothing here can disagree with the page the link opens.
  expect(rowsOf(referringTo(viewOf(HOUSE), "herbs")).see[0]).toEqual({
    id: "order",
    title: "order the cabinets",
    from: "house.olai",
  })
})

test("a node nothing refers to, and a first frame with no indexes, are both empty", () => {
  expect(referringTo(viewOf(HOUSE), "kitchen")).toEqual([])
  expect(referringTo(undefined, "herbs")).toEqual([])
})
