/**
 * What the drawer draws, without a browser: which keys, in what order, as what
 * text.
 *
 * The two decisions the component does not make, and the two that go quietly
 * wrong — a system key leaking onto a line beside the checkbox that already
 * says it, and an order that changes under the reader between one frame and the
 * next.
 */

import type { RegularNode } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { drawerEntries, isLink } from "./drawer.ts"

const nodeOf = (record: string): RegularNode =>
  setOf({ "a.olai": record }).nodes[0]?.node as RegularNode

test("the keys olai reads are not drawn, whatever else the node carries", () => {
  // Every one of them is already on the row: the checkbox, the tone it takes,
  // the date pill, the reference rows under the note.
  const node = nodeOf(
    `{"id":"x","ord":"a0","title":"t","props":{"status":"doing","since":"2026-08-01",` +
      `"date":"2026-08-10","after":["y"],"blocks":["z"],"see":["w"],"pr":"https://x/1"}}`,
  )
  expect(drawerEntries(node)).toEqual([{ key: "pr", value: "https://x/1", listed: false }])
})

test("a node carrying nothing but system keys has no drawer at all", () => {
  expect(drawerEntries(nodeOf(`{"id":"x","ord":"a0","title":"t","props":{"status":"done"}}`)))
    .toEqual([])
  expect(drawerEntries(nodeOf(`{"id":"x","ord":"a0","title":"t"}`))).toEqual([])
})

/**
 * THE FILE'S OWN ORDER, which for user keys is alphabetical — not the order
 * they were written in, which the record does not remember.
 *
 * The record's key order is canonical so that two files meaning the same thing
 * are byte for byte the same (`@olai/format`'s `props.ts`). A drawer keeping
 * "insertion order" would therefore be keeping the order of whatever last wrote
 * the map, and would re-sort itself the next time the file was read.
 */
test("the lines are in the file's own order", () => {
  const node = nodeOf(
    `{"id":"x","ord":"a0","title":"t","props":{"terminal":"485cd9bb","agent":"claude-opus","pr":"https://x/1"}}`,
  )
  expect(drawerEntries(node).map((entry) => entry.key)).toEqual(["agent", "pr", "terminal"])
})

test("a list is drawn joined, and says that it is one", () => {
  const node = nodeOf(`{"id":"x","ord":"a0","title":"t","props":{"tags":["a","b"]}}`)
  expect(drawerEntries(node)).toEqual([{ key: "tags", value: "a, b", listed: true }])
})

test("a link is a value that already is one, and nothing else", () => {
  expect(isLink("https://github.com/juspay/olai/pull/176")).toBe(true)
  expect(isLink("http://localhost:3000")).toBe(true)
  // Nothing here parses a value: a URL is a string that looks like a URL, and
  // guessing at the rest would make `claude-opus` a link to nowhere.
  expect(isLink("github.com/juspay/olai")).toBe(false)
  expect(isLink("485cd9bb")).toBe(false)
})
