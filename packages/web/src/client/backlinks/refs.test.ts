/**
 * The section's arithmetic: one reading of what refers to a node, split into
 * the two rows that draw it and counted once.
 *
 * What COUNTS as a reference is `@olai/format`'s (`backlinks.test.ts` holds the
 * four rulings); what is asserted here is the shape the client needs — a record
 * doing both things appearing in both rows, and the count being records rather
 * than links, because that number is the whole of what a shut section says.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { referrersOf } from "./refs.ts"

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
  const found = referrersOf(viewOf(HOUSE), "herbs")
  expect(found.rows.see.map((ref) => ref.id)).toEqual(["order", "both"])
  expect(found.rows.mention.map((ref) => ref.id)).toEqual(["install", "both"])
  // THREE, not four: the count is the records referring, which is what
  // "Referenced by 3 nodes" claims.
  expect(found.total).toBe(3)
})

test("a link carries the referrer's own title and the outline it is written in", () => {
  // Read off the record rather than resolved again: this list is already
  // records, so nothing here can disagree with the page the link opens.
  expect(referrersOf(viewOf(HOUSE), "herbs").rows.see[0]).toEqual({
    id: "order",
    title: "order the cabinets",
    from: "house.olai",
  })
})

test("a node nothing refers to, and a first frame with no indexes, are both empty", () => {
  expect(referrersOf(viewOf(HOUSE), "kitchen").total).toBe(0)
  expect(referrersOf(undefined, "herbs").total).toBe(0)
})
