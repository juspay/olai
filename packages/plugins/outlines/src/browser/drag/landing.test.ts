import { expect, test } from "bun:test"
import { anchorFor, nodeText } from "./landing.ts"
test("text becomes one node with its remaining lines as a note", () => {
  expect(nodeText("title")).toEqual({ title: "title" })
  expect(nodeText("\n title\nnote\nsecond\n  ")).toEqual({ title: "title", desc: "note\nsecond" })
})
test("drop gaps map to the existing add anchors", () => {
  expect(anchorFor({ parent: null, after: null }, "a.olai")).toEqual({ kind: "first", file: "a.olai" })
  expect(anchorFor({ parent: "p", after: null }, "a.olai")).toEqual({ kind: "under", id: "p" })
  expect(anchorFor({ parent: "p", after: "s" }, "a.olai")).toEqual({ kind: "after", id: "s" })
})
