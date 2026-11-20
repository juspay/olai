import { TEST_CLAIMS } from "@olai/format/testlib"
import { derive, zoom } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { filterItems } from "olai-plugin-navigation/palette-model"
import { opItems } from "./ops.ts"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
const routes = routingIn()


const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel","doing":true}`,
  `{"id":"order","parent":"kitchen","ord":"a1","title":"order the cabinets","date":"2026-08-10"}`,
  `{"id":"install","parent":"kitchen","ord":"a2","title":"install them"}`,
].join("\n")

const derived = derive(TEST_CLAIMS, recordsOf(setOf({ "house.olai": HOUSE })))

const at = (id: string) => {
  const zoomed = zoom(derived, id)
  if (zoomed.kind !== "node") throw new Error(`\`${id}\` is not a node page`)
  return zoomed
}

const labels = (id: string): ReadonlyArray<string> =>
  opItems(routes, at(id), at(id).under).map((item) => item.label)

test("a page that is not a zoom offers no op rows at all", () => {
  expect(opItems(routes, undefined, undefined)).toEqual([])
})

test("the zoomed node's own verbs, minus the one that opens a picker", () => {
  expect(labels("kitchen")).toEqual([
    "Mark: To do",
    "Mark: Done",
    "Mark: Cancelled",
    "Mark: Clear",
    "Duplicate",
    "Move to Trash",
  ])
  expect(labels("order")).toContain("Clear date")
})

test("every row says which node it is about, on the place line", () => {
  const rows = opItems(routes, at("order"), at("order").under)
  expect(rows.every((row) => row.place === "on “order the cabinets”")).toBe(true)
  expect(rows.every((row) => row.search === "order the cabinets")).toBe(true)
  expect(filterItems("cabinets", rows).length).toBe(rows.length)
  expect(filterItems("mark: done", rows).map((row) => row.label)).toEqual(["Mark: Done"])
})

test("a row carries the edit it will send, and the archive carries its question", () => {
  const rows = opItems(routes, at("install"), at("install").under)
  const complete = rows.find((row) => row.label === "Mark: Done")
  expect(complete?.action).toEqual({
    kind: "edit",
    edit: { verb: "mark", id: "install", mark: "done" },
  })
  const trash = rows.find((row) => row.label === "Move to Trash")
  expect(trash?.action).toMatchObject({
    kind: "edit",
    edit: { verb: "trash", id: "install" },
  })
  expect(
    trash?.action.kind === "edit" ? trash.action.confirm : undefined,
  ).toContain("Move “install them” to Trash?")
})

test("the ids are namespaced, so a shell row and an op row cannot collide", () => {
  expect(opItems(routes, at("kitchen"), at("kitchen").under).map((row) => row.id))
    .toEqual([
      "op-mark-todo",
      "op-mark-done",
      "op-mark-cancelled",
      "op-clear-mark",
      "op-duplicate",
      "op-trash",
    ])
})

test("with no indexes yet the archive is not offered, rather than uncounted", () => {
  expect(opItems(routes, at("kitchen"), undefined).map((row) => row.label))
    .toEqual(["Mark: To do", "Mark: Done", "Mark: Cancelled", "Mark: Clear", "Duplicate"])
})

test("the shelf's verb is not among them — the palette's pin row is the PAGE's", () => {
  expect(labels("order")).not.toContain("Pin to sidebar")
  expect(labels("order")).not.toContain("Unpin from sidebar")
})
