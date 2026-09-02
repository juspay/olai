import type { Row } from "@olai/format"
import { expect, test } from "bun:test"

import { alongside, inside, parentKeyOf, spanning, topmost } from "./range.ts"

/** A drawn row, as far as a selection is concerned: the place it sits in. Built
 *  by hand for the reason `../edit/order.test.ts` builds its own — what is
 *  under test is arithmetic over places, and `@olai/format` has its own suite
 *  for producing them. */
const row = (key: string): Row =>
  ({
    kind: "node",
    key,
    children: [],
    at: { file: "house.org", node: { id: key.slice(key.lastIndexOf("/") + 1) } },
    shows: { file: "house.org", node: { id: key.slice(key.lastIndexOf("/") + 1) } },
  } as unknown as Row)

//   a
//   ├ a1
//   │ └ a1x
//   └ a2
//   b
const drawn: ReadonlyArray<Row> = ["/a", "/a/a1", "/a/a1/a1x", "/a/a2", "/b"].map(row)

test("a place's parent is its key with the last id taken off", () => {
  expect(parentKeyOf("/a/a1/a1x")).toBe("/a/a1")
  // A root of the page: `""`, which two roots share — and sharing it is what
  // makes them siblings.
  expect(parentKeyOf("/a")).toBe("")
})

test("containment is a prefix, and a row is not inside itself", () => {
  expect(inside("/a", "/a/a1")).toBe(true)
  expect(inside("/a", "/a/a1/a1x")).toBe(true)
  expect(inside("/a", "/a")).toBe(false)
  // Not a prefix of the KEY — a sibling whose id merely starts the same way.
  expect(inside("/a", "/ab")).toBe(false)
})

test("a span is taken in drawn order, whichever end was pressed first", () => {
  expect(spanning(drawn, "/a/a1", "/b")).toEqual(["/a/a1", "/a/a1/a1x", "/a/a2", "/b"])
  expect(spanning(drawn, "/b", "/a/a1")).toEqual(["/a/a1", "/a/a1/a1x", "/a/a2", "/b"])
  expect(spanning(drawn, "/a", "/a")).toEqual(["/a"])
})

test("a span with an end that is not drawn is no span at all", () => {
  expect(spanning(drawn, "/a", "/gone")).toEqual([])
})

test("a verb is asked of the rows nothing else selected contains", () => {
  // Dragging across a parent and its children is what dragging across them
  // looks like — and the subtree moves whole, so only the parent is asked.
  const keys = new Set(["/a", "/a/a1", "/a/a1/a1x", "/b"])
  expect(topmost(drawn, keys).map((one) => one.key)).toEqual(["/a", "/b"])
})

test("...and it keeps a deeper row whose ancestor is NOT selected", () => {
  expect(
    topmost(drawn, new Set(["/a/a1/a1x", "/a/a2"])).map((one) => one.key),
  ).toEqual(["/a/a1/a1x", "/a/a2"])
})

test("topmost answers in drawn order, because that is what the ops are sent in", () => {
  expect(
    topmost(drawn, new Set(["/b", "/a/a2", "/a/a1"])).map((one) => one.key),
  ).toEqual(["/a/a1", "/a/a2", "/b"])
})

test("the siblings of a place are the rows drawn beside it, itself included", () => {
  expect(alongside(drawn, "/a/a1")).toEqual(["/a/a1", "/a/a2"])
  expect(alongside(drawn, "/a")).toEqual(["/a", "/b"])
  expect(alongside(drawn, "/gone")).toEqual([])
})
