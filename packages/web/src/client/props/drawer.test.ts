/**
 * What the drawer draws, without a browser: which lines, in what order, as what
 * text.
 *
 * The decisions the component does not make, and the ones that go quietly
 * wrong — a fact drawn twice on one screen, an order that changes under the
 * reader between one frame and the next.
 */

import { customOf, type RegularNode } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { customEntries, drawerEntries, isLink, systemEntries } from "./drawer.ts"

const nodeOf = (record: string): RegularNode =>
  recordsOf(setOf({ "a.olai": record }))[0]?.node as RegularNode

test("the id is always a line, because nothing else on the page says it", () => {
  // The ruling this file was rewritten for: an id is what every tool call and
  // every `((` reference takes, and it was readable nowhere.
  expect(systemEntries(nodeOf(`{"id":"order","ord":"a0","title":"t"}`)))
    .toEqual([{ key: "id", value: "order", system: true, listed: false }])
})

/** The mark is ONE line holding both of what the field holds. The record has
 *  one field carrying two facts, and splitting them here would be the drawer
 *  inventing a shape the format does not have. */
test("the mark is one line, with its instant when it has one", () => {
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","doing":true}`))[1])
    .toEqual({ key: "status", value: "doing", system: true, listed: false })
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","done":"2026-08-01"}`))[1])
    .toEqual({ key: "status", value: "done 2026-08-01", system: true, listed: false })
})

test("a date is a line; a note, a document and the edges are not", () => {
  // What is in the system half is exactly the facts with nowhere else to show.
  // `see` is a reference row under the note, `desc` is the note, `doc` is the
  // document line — repeating any of them here would put two spellings of one
  // fact on one screen.
  const node = nodeOf(
    `{"id":"n","ord":"a0","title":"t","date":"2026-08-10","desc":"a note","doc":"x.md","see":["y"],"after":["z"]}`,
  )
  expect(systemEntries(node).map((entry) => entry.key)).toEqual(["id", "date"])
})

test("the stamps are drawn when the node has them, and never invented", () => {
  // Absent is the ordinary state of a node written before olai stamped
  // anything, and the drawer says what the record says.
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t"}`)).map((one) => one.key))
    .toEqual(["id"])
  const stamped = nodeOf(
    `{"id":"n","ord":"a0","title":"t","created":"2026-08-11T09:00:00-04:00","changed":"2026-08-15T14:00:00-04:00"}`,
  )
  expect(systemEntries(stamped).map((one) => one.key)).toEqual(["id", "created", "changed"])
})

test("the custom half is what somebody added, and nothing else", () => {
  const node = nodeOf(
    `{"id":"n","ord":"a0","title":"t","done":true,"date":"2026-08-10","custom":{"pr":"https://x/1"}}`,
  )
  expect(customEntries(customOf(node))).toEqual([
    { key: "pr", value: "https://x/1", system: false, listed: false },
  ])
  // ...and the whole drawer is the facts first, then the properties.
  expect(drawerEntries(node).map((entry) => entry.key)).toEqual(["id", "status", "date", "pr"])
})

/**
 * THE FILE'S OWN ORDER, which for custom keys is alphabetical — not the order
 * they were written in, which the record does not remember.
 *
 * A record's key order is canonical so that two files meaning the same thing
 * are byte for byte the same (`@olai/format`'s `custom.ts`). A drawer keeping
 * "insertion order" would be keeping the order of whatever last wrote the map,
 * and would re-sort itself the next time the file was read.
 */
test("the custom lines are in the file's own order", () => {
  const node = nodeOf(
    `{"id":"n","ord":"a0","title":"t","custom":{"terminal":"485cd9bb","agent":"claude-opus","pr":"https://x/1"}}`,
  )
  expect(customEntries(customOf(node)).map((entry) => entry.key)).toEqual(["agent", "pr", "terminal"])
})

test("a list is drawn joined, and says that it is one", () => {
  const node = nodeOf(`{"id":"n","ord":"a0","title":"t","custom":{"tags":["a","b"]}}`)
  expect(customEntries(customOf(node)))
    .toEqual([{ key: "tags", value: "a, b", system: false, listed: true }])
})

test("a link is a value that already is one, and nothing else", () => {
  expect(isLink("https://github.com/juspay/olai/pull/176")).toBe(true)
  expect(isLink("http://localhost:3000")).toBe(true)
  // Nothing here parses a value: a URL is a string that looks like a URL, and
  // guessing at the rest would make `claude-opus` a link to nowhere.
  expect(isLink("github.com/juspay/olai")).toBe(false)
  expect(isLink("485cd9bb")).toBe(false)
})
