import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, nodeNamed } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import type { Names } from "olai-plugin-outlines/names"
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

const derived = derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })))

const names: Names = (id) => {
  const found = nodeNamed(derived, id)
  return found === undefined
    ? undefined
    : { id, title: found.node.title, file: found.file }
}

const refs = (id: string, relation: Relation) => {
  const found = derived.byId.get(id)
  if (found === undefined || "mirror" in found.node) {
    throw new Error(`no regular node \`${id}\` in the fixture`)
  }
  return namedBy(found.node, relation, () => names)
}

const targets = (id: string, relation: Relation): ReadonlyArray<string> =>
  refs(id, relation).map((one) => one.id)

test("a target the file names three times is drawn once", () => {
  expect(targets("order", "see")).toEqual(["herbs"])
  expect(refs("order", "see")[0]?.title).toBe("the herb bed")
  expect(refs("order", "see")[0]?.from).toBe("garden.olai")
})

test("the other targets, and their order, survive the drop", () => {
  expect(targets("order", "after")).toEqual(["demo", "herbs"])
})

test("a dangling target repeated is one row that says what the file says", () => {
  expect(refs("dangling", "see")).toEqual([{ id: "gone", title: "gone", from: "" }])
})

test("two ids standing at one node are two targets, because the file said two", () => {
  expect(targets("twice-named", "see")).toEqual(["herbs", "kitchen-herbs"])
})

test("a node carrying nothing on the field names nothing", () => {
  expect(targets("demo", "see")).toEqual([])
})
