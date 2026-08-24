/**
 * What the drawer draws, without a browser: which chips, in what order, as what
 * text.
 *
 * The decisions the component does not make, and the ones that go quietly
 * wrong — a fact drawn twice on one screen, an order that changes under the
 * reader between one frame and the next. WHERE A CHIP GOES when it is pressed
 * is the other half and has its own file (`./door.test.ts`).
 */

import { customOf, type RegularNode } from "@olai/format"
import { recordsOf, setOf } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { customEntries, drawerEntries, systemEntries } from "./drawer.ts"

const nodeOf = (record: string): RegularNode =>
  recordsOf(setOf({ "a.olai": record }))[0]?.node as RegularNode

test("the id is always a line, because nothing else on the page says it", () => {
  // The ruling this file was rewritten for: an id is what every tool call and
  // every `((` reference takes, and it was readable nowhere.
  expect(systemEntries(nodeOf(`{"id":"order","ord":"a0","title":"t"}`)))
    .toEqual([{ key: "id", value: "order", values: ["order"], system: true, listed: false }])
})

/** The mark is ONE line holding both of what the field holds. The record has
 *  one field carrying two facts, and splitting them here would be the drawer
 *  inventing a shape the format does not have. */
test("the mark is one line, with its instant when it has one", () => {
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","doing":true}`))[1])
    .toEqual({ key: "status", value: "doing", values: ["doing"], system: true, listed: false })
  expect(systemEntries(nodeOf(`{"id":"n","ord":"a0","title":"t","done":"2026-08-01"}`))[1])
    .toEqual({
      key: "status",
      value: "done 2026-08-01",
      values: ["done 2026-08-01"],
      system: true,
      listed: false,
    })
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
    { key: "pr", value: "https://x/1", values: ["https://x/1"], system: false, listed: false },
  ])
  // ...and the whole drawer is the facts first, then the properties.
  expect(drawerEntries(node).map((entry) => entry.key)).toEqual(["id", "status", "date", "pr"])
})

/**
 * THE FILE'S OWN ORDER, and never alphabetical — the two are not the same
 * sentence even though they usually agree.
 *
 * A record OLAI wrote is alphabetical on disk because the writer canonicalises,
 * so that two files meaning the same thing are byte for byte the same
 * (`@olai/format`'s `custom.ts`). A record a hand or an agent edited holds its
 * keys in the order the person thought about them in, and the parse keeps that
 * order all the way here. Sorting at the draw would take the author's order
 * away in the one case where there is one, to no gain in the case where there
 * is not.
 */
test("the custom chips are in the file's own order, whatever order that is", () => {
  const canonical = nodeOf(
    `{"id":"n","ord":"a0","title":"t","custom":{"agent":"claude-opus","pr":"https://x/1","terminal":"485cd9bb"}}`,
  )
  expect(customEntries(customOf(canonical)).map((entry) => entry.key))
    .toEqual(["agent", "pr", "terminal"])

  const handWritten = nodeOf(
    `{"id":"n","ord":"a0","title":"t","custom":{"terminal":"485cd9bb","agent":"claude-opus","pr":"https://x/1"}}`,
  )
  expect(customEntries(customOf(handWritten)).map((entry) => entry.key))
    .toEqual(["terminal", "agent", "pr"])
})

test("a list is drawn joined, says that it is one, and keeps its members", () => {
  // The joined string is what a search row draws (`../search/props.ts`); the
  // members are what the run asks the door question of, one at a time.
  const node = nodeOf(`{"id":"n","ord":"a0","title":"t","custom":{"tags":["a","b"]}}`)
  expect(customEntries(customOf(node)))
    .toEqual([{ key: "tags", value: "a, b", values: ["a", "b"], system: false, listed: true }])
})

test("a value that is TEXT is one member, so the run has one rule and not two", () => {
  const node = nodeOf(`{"id":"n","ord":"a0","title":"t","custom":{"agent":"claude-opus"}}`)
  expect(customEntries(customOf(node))[0]?.values).toEqual(["claude-opus"])
  expect(customEntries(customOf(node))[0]?.listed).toBe(false)
})

test("a document's frontmatter is the same run, over the map", () => {
  // `customEntries` takes the map, not a carrier — so a document's Face.props
  // spends the same spelling a record's custom does, and a list is joined
  // here once rather than in two drawers.
  expect(customEntries({
    agent: "claude-opus",
    owners: ["alice", "bob"],
    date: "2026-09-01",
  }).map((entry) => entry.key)).toEqual(["agent", "owners", "date"])
  expect(customEntries({ owners: ["alice", "bob"] }))
    .toEqual([{
      key: "owners",
      value: "alice, bob",
      values: ["alice", "bob"],
      system: false,
      listed: true,
    }])
})
