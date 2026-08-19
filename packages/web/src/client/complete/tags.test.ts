/**
 * The tag vocabulary of a set, and which of it a prefix means.
 *
 * Over a real derivation rather than a hand-made list, because the claim this
 * makes is about the SET: what the widget offers is what somebody has already
 * written down, counted the way a reader would count it — which means mirrors
 * are not a second vote for their target's tags.
 */

import { expect, test } from "bun:test"
import { derive } from "@olai/format"
import { nodesOf, nodesOfFiles } from "@olai/format/testlib"

import { matchTags, tagsOf } from "./tags.ts"

const set = (contents: string) => derive(nodesOf(contents))

const written = (tags: ReadonlyArray<{ sigil: string; name: string }>) =>
  tags.map((tag) => `${tag.sigil}${tag.name}`)

const HOUSE = set(`
{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
{"id":"order","parent":"kitchen","ord":"a1","title":"order cabinets #home #shopping"}
{"id":"ask","parent":"kitchen","ord":"a2","title":"ask @alice about the #hob"}
{"id":"call","parent":"kitchen","ord":"a3","title":"call @alice back"}
{"id":"again","parent":"kitchen","ord":"a4","mirror":"order"}
`)

test("every tag the set uses, most used first and alphabetical within a count", () => {
  // `@alice` and `#home` are both on two nodes; `alice` sorts first.
  expect(written(tagsOf(HOUSE))).toEqual(["@alice", "#home", "#hob", "#shopping"])
})

test("a tag is counted once per node that writes it, mirrors excluded", () => {
  // `order` carries `#home` and is drawn twice; the count is of NODES.
  const home = tagsOf(HOUSE).find((tag) => tag.name === "home")
  expect(home?.count).toBe(2)
})

// ONE VOTE PER RECORD, whichever prose said it and however often — the index's
// own rule (`Derived.taggedBy`), which this list inherits rather than restates.
test("a record writing one tag twice is one vote for it", () => {
  const twice = set(`{"id":"a","ord":"a0","title":"#home and #home","desc":"still #home"}`)
  expect(tagsOf(twice).find((tag) => tag.name === "home")?.count).toBe(1)
})

// A NOTE IS VOCABULARY TOO. This is what changed when the walk became an index
// read: the old walk looked at titles only, so a tag somebody had written in a
// note was not offered back to them.
test("a tag written in a note is offered, and counted", () => {
  const noted = set(
    `{"id":"a","ord":"a0","title":"the kitchen"}\n` +
      `{"id":"b","ord":"a1","title":"the shed","desc":"see the #hob about this"}`,
  )
  expect(written(tagsOf(noted))).toEqual(["#hob"])
  expect(tagsOf(noted)[0]?.count).toBe(1)
})

// The re-key the index was rebuilt for: two namespaces that a sigil-stripped
// index would have offered as one name under both sigils.
test("a name written with both sigils is two tags, each counted its own way", () => {
  const both = set(
    `{"id":"a","ord":"a0","title":"ask @herbs"}\n` +
      `{"id":"b","ord":"a1","title":"filed under #herbs"}\n` +
      `{"id":"c","ord":"a2","title":"also #herbs"}`,
  )
  expect(written(tagsOf(both))).toEqual(["#herbs", "@herbs"])
  expect(tagsOf(both).map((tag) => tag.count)).toEqual([2, 1])
  expect(written(matchTags(tagsOf(both), "@", "her"))).toEqual(["@herbs"])
})

// What was put away is out of the vocabulary AND out of the count (ruled
// 2026-08-17: archived nodes are drawn on the trash page and nowhere else). The
// number beside a name is a promise about rows, and pressing the name filters a
// page that draws none of the archive — so a count that included it would
// promise rows the reader cannot be shown.
test("what is in the trash is not counted, and a tag only it used is not offered", () => {
  const withArchive = derive(nodesOfFiles({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    "Archive.olai": [
      `{"id":"old","ord":"a0","title":"the old kitchen #home"}`,
      `{"id":"gone","ord":"a1","title":"the old boiler #boiler"}`,
    ].join("\n"),
  }))
  const tags = tagsOf(withArchive)
  expect(written(tags)).toEqual(["#home"])
  expect(tags.find((tag) => tag.name === "home")?.count).toBe(1)
})

test("no set is no tags rather than a throw", () => {
  expect(tagsOf(undefined)).toEqual([])
})

// ── which of them a prefix means ───────────────────────────────────────

test("the two sigils are two lists", () => {
  // `@` offers what has been written with an `@`. Offering `#home` under an `@`
  // would be the widget inventing a tag the set does not hold.
  expect(written(matchTags(tagsOf(HOUSE), "@", ""))).toEqual(["@alice"])
  expect(written(matchTags(tagsOf(HOUSE), "#", ""))).toEqual([
    "#home",
    "#hob",
    "#shopping",
  ])
})

test("a prefix beats a substring", () => {
  expect(written(matchTags(tagsOf(HOUSE), "#", "ho"))).toEqual([
    "#home",
    "#hob",
    // ...and a substring last: `shopping` holds `ho` in the middle.
    "#shopping",
  ])
  expect(written(matchTags(tagsOf(HOUSE), "#", "opping"))).toEqual(["#shopping"])
})

test("matching folds case, because a tag's case is its author's", () => {
  const mixed = set(`{"id":"a","ord":"a0","title":"one #Racket-Parity"}`)
  expect(written(matchTags(tagsOf(mixed), "#", "racket"))).toEqual(["#Racket-Parity"])
})

test("a prefix nothing starts or holds is nothing", () => {
  expect(matchTags(tagsOf(HOUSE), "#", "zzz")).toEqual([])
})
