/**
 * What an edge field NAMES, as the two surfaces that draw it read it: the
 * targets, their titles, and how many of them there are.
 *
 * The count is the reason this file exists. `namedBy` is one reading shared by
 * the row of links and the panel that writes them, and both of them draw a
 * link per target keyed by the target's id — so "a target named twice" is a
 * question about the KEY, not about tidiness: three links under one key hand
 * the framework one element three times and the next store frame kills the page
 * (PR #202, and `../NodeRefs.tsx`). The set semantics are the WRITE layer's
 * already, so the reading agrees with it here rather than deciding anything.
 */

import { derive } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { namedBy } from "./named.ts"
import type { Relation } from "./relation.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","doing":true,"see":["herbs","herbs","herbs"],"after":["demo","herbs","demo"]}`,
  `{"id":"demo","parent":"kitchen","ord":"a0","title":"take out the counters","done":"2026-08-03"}`,
  `{"id":"kitchen-herbs","parent":"kitchen","ord":"a3","mirror":"herbs"}`,
  `{"id":"twice-named","parent":"kitchen","ord":"a4","title":"names one node two ways","see":["herbs","kitchen-herbs"]}`,
  `{"id":"dangling","parent":"kitchen","ord":"a5","title":"names what nothing declares","see":["gone","gone"]}`,
].join("\n")

const GARDEN = `{"id":"herbs","ord":"a0","title":"the herb bed","todo":true}`

const derived = derive(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }).nodes)

/** One node's field, resolved — the indexes always here, which is the frame
 *  every one of these claims is about. The absent-indexes frame is its own
 *  answer and `./named.ts` says why. */
const refs = (id: string, relation: Relation) => {
  const found = derived.byId.get(id)
  if (found === undefined || "mirror" in found.node) {
    throw new Error(`no regular node \`${id}\` in the fixture`)
  }
  return namedBy(found.node, relation, () => derived)
}

const targets = (id: string, relation: Relation): ReadonlyArray<string> =>
  refs(id, relation).map((one) => one.id)

test("a target the file names three times is drawn once", () => {
  // `set_see` re-adding a target the node already names is a silent no-op, so
  // the field is a set on the way in; this is the reading saying the same
  // thing on the way out. One ref, and it still carries the target's own
  // title — the repeat is dropped, not the resolution.
  expect(targets("order", "see")).toEqual(["herbs"])
  expect(refs("order", "see")[0]?.title).toBe("the herb bed")
  expect(refs("order", "see")[0]?.from).toBe("garden.olai")
})

test("the other targets, and their order, survive the drop", () => {
  // Where a repeat is dropped is where the SECOND one stands: the list still
  // reads as the file wrote it, which is what `after` promises about the order
  // it names its dependencies in.
  expect(targets("order", "after")).toEqual(["demo", "herbs"])
})

test("a dangling target repeated is one row that says what the file says", () => {
  // Nothing declares `gone`, so the title falls back to the id (a set under
  // the stale banner can hold one) — and it is still ONE row.
  expect(refs("dangling", "see")).toEqual([{ id: "gone", title: "gone", from: "" }])
})

test("two ids standing at one node are two targets, because the file said two", () => {
  // The set is over the id AS WRITTEN, which is the identity the write layer's
  // own set is over: naming a placement beside the node it shows is two things
  // the file says, and they key apart. Collapsing them would be this read
  // deciding something no writer has.
  expect(targets("twice-named", "see")).toEqual(["herbs", "kitchen-herbs"])
})

test("a node carrying nothing on the field names nothing", () => {
  expect(targets("demo", "see")).toEqual([])
})
