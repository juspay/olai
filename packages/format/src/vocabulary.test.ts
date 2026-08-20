/**
 * The tag vocabulary of a set, and which of it a prefix means.
 *
 * Over a real derivation rather than a hand-made list, because the claim this
 * makes is about the SET: what a completion offers is what somebody has already
 * written down, counted the way a reader would count it — which means mirrors
 * are not a second vote for their target's tags.
 *
 * It moved here with the reading it covers (`@olai/web`'s `complete/tags.ts`
 * until `vault-in-browser`'s PR 2), unchanged in what it asserts: the rules are
 * the same rules, asked one package down where both faces can call them.
 */

import { expect, test } from "bun:test"

import { derive, type Derived } from "./derive.ts"
import { nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import {
  completingTags,
  type TagCompletion,
  type TagsRequest,
  type TagUse,
  vocabularyOf,
} from "./vocabulary.ts"

const set = (contents: string) => derive(nodesOf(contents))

const written = (tags: ReadonlyArray<TagUse>) =>
  tags.map((tag) => `${tag.sigil}${tag.name}`)

/** What one popup asks — the widget's own cap, so these read the way the rows
 *  on screen do. */
const asking = (sigil: TagsRequest["sigil"], query: string): TagsRequest => ({
  sigil,
  query,
  limit: 8,
})

/** ...and what it draws, which is the sigil it asked with plus the name it was
 *  answered — the assembly `complete/completing.tsx` does. */
const offered = (
  sigil: TagsRequest["sigil"],
  rows: ReadonlyArray<TagCompletion>,
) => rows.map((row) => `${sigil}${row.name}`)

const matched = (
  derived: Derived,
  sigil: TagsRequest["sigil"],
  query: string,
) => offered(sigil, completingTags(derived, asking(sigil, query)))

const HOUSE = set(`
{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}
{"id":"order","parent":"kitchen","ord":"a1","title":"order cabinets #home #shopping"}
{"id":"ask","parent":"kitchen","ord":"a2","title":"ask @alice about the #hob"}
{"id":"call","parent":"kitchen","ord":"a3","title":"call @alice back"}
{"id":"again","parent":"kitchen","ord":"a4","mirror":"order"}
`)

test("every tag the set uses, most used first and alphabetical within a count", () => {
  // `@alice` and `#home` are both on two nodes; `alice` sorts first.
  expect(written(vocabularyOf(HOUSE))).toEqual([
    "@alice",
    "#home",
    "#hob",
    "#shopping",
  ])
})

test("a tag is counted once per node that writes it, mirrors excluded", () => {
  // `order` carries `#home` and is drawn twice; the count is of NODES.
  const home = vocabularyOf(HOUSE).find((tag) => tag.name === "home")
  expect(home?.count).toBe(2)
})

// ONE VOTE PER RECORD, whichever prose said it and however often — the index's
// own rule (`Derived.taggedBy`), which this list inherits rather than restates.
test("a record writing one tag twice is one vote for it", () => {
  const twice = set(`{"id":"a","ord":"a0","title":"#home and #home","desc":"still #home"}`)
  expect(vocabularyOf(twice).find((tag) => tag.name === "home")?.count).toBe(1)
})

// A NOTE IS VOCABULARY TOO. This is what changed when the walk became an index
// read: the old walk looked at titles only, so a tag somebody had written in a
// note was not offered back to them.
test("a tag written in a note is offered, and counted", () => {
  const noted = set(
    `{"id":"a","ord":"a0","title":"the kitchen"}\n` +
      `{"id":"b","ord":"a1","title":"the shed","desc":"see the #hob about this"}`,
  )
  expect(written(vocabularyOf(noted))).toEqual(["#hob"])
  expect(vocabularyOf(noted)[0]?.count).toBe(1)
})

// The re-key the index was rebuilt for: two namespaces that a sigil-stripped
// index would have offered as one name under both sigils.
test("a name written with both sigils is two tags, each counted its own way", () => {
  const both = set(
    `{"id":"a","ord":"a0","title":"ask @herbs"}\n` +
      `{"id":"b","ord":"a1","title":"filed under #herbs"}\n` +
      `{"id":"c","ord":"a2","title":"also #herbs"}`,
  )
  expect(written(vocabularyOf(both))).toEqual(["#herbs", "@herbs"])
  expect(vocabularyOf(both).map((tag) => tag.count)).toEqual([2, 1])
  expect(matched(both, "@", "her")).toEqual(["@herbs"])
})

// What was put away is out of the vocabulary AND out of the count (ruled
// 2026-08-17: archived nodes are drawn on the trash page and nowhere else). The
// number beside a name is a promise about rows, and pressing the name filters a
// page that draws none of the trash — so a count that included it would promise
// rows the reader cannot be shown.
test("what is in the trash is not counted, and a tag only it used is not offered", () => {
  const withArchive = derive(nodesOfFiles({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    "_olai/Trash.olai": [
      `{"id":"old","ord":"a0","title":"the old kitchen #home"}`,
      `{"id":"gone","ord":"a1","title":"the old boiler #boiler"}`,
    ].join("\n"),
  }))
  const tags = vocabularyOf(withArchive)
  expect(written(tags)).toEqual(["#home"])
  expect(tags.find((tag) => tag.name === "home")?.count).toBe(1)
})

test("a leftover Archive.olai is not counted in the live vocabulary either", () => {
  const withLeftover = derive(nodesOfFiles({
    "house.olai": `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    "Archive.olai": [
      `{"id":"old","ord":"a0","title":"the old kitchen #home"}`,
      `{"id":"gone","ord":"a1","title":"the old boiler #boiler"}`,
    ].join("\n"),
  }))
  const tags = vocabularyOf(withLeftover)
  expect(written(tags)).toEqual(["#home"])
  expect(tags.find((tag) => tag.name === "home")?.count).toBe(1)
})

test("a set with no tags in it is no vocabulary rather than a throw", () => {
  expect(vocabularyOf(set(`{"id":"a","ord":"a0","title":"nothing tagged here"}`)))
    .toEqual([])
})

// ONE READING PER DERIVATION — the memo is what makes asking per settled
// keystroke cost the match and nothing else, so it is pinned by identity rather
// than left to be believed.
test("the vocabulary is counted once per derivation and handed back after that", () => {
  expect(vocabularyOf(HOUSE)).toBe(vocabularyOf(HOUSE))
  // ...and a new view over the same indexes is a new question, which is what a
  // published revision hands a reader.
  expect(vocabularyOf({ ...HOUSE })).not.toBe(vocabularyOf(HOUSE))
})

// ── which of them a prefix means ───────────────────────────────────────

test("the two sigils are two lists", () => {
  // `@` offers what has been written with an `@`. Offering `#home` under an `@`
  // would be answering with a tag the set does not hold.
  expect(matched(HOUSE, "@", "")).toEqual(["@alice"])
  expect(matched(HOUSE, "#", "")).toEqual(["#home", "#hob", "#shopping"])
})

test("a prefix beats a substring", () => {
  expect(matched(HOUSE, "#", "ho")).toEqual([
    "#home",
    "#hob",
    // ...and a substring last: `shopping` holds `ho` in the middle.
    "#shopping",
  ])
  expect(matched(HOUSE, "#", "opping")).toEqual(["#shopping"])
})

test("matching folds case, because a tag's case is its author's", () => {
  const mixed = set(`{"id":"a","ord":"a0","title":"one #Racket-Parity"}`)
  expect(matched(mixed, "#", "racket")).toEqual(["#Racket-Parity"])
})

test("a prefix nothing starts or holds is nothing", () => {
  expect(matched(HOUSE, "#", "zzz")).toEqual([])
})

// The CAP is the door's, sent on every request — so the answer is as long as
// the popup that asked has room for and never longer.
test("the answer stops at the number of rows the asker said it had", () => {
  const many = set(
    Array.from(
      { length: 12 },
      (_, at) => `{"id":"n${at}","ord":"a${at}","title":"row #topic${at}"}`,
    ).join("\n"),
  )
  expect(vocabularyOf(many)).toHaveLength(12)
  expect(completingTags(many, { sigil: "#", query: "", limit: 3 }))
    .toHaveLength(3)
})

// A COUNT TRAVELS, because that is what orders the list and what the popup draws
// at the right of a row. Nothing else about a tag does: the sigil is the
// question, and the fold is a cost of matching.
test("an answer row is the name and the count, and nothing else", () => {
  expect(completingTags(HOUSE, asking("#", "ho"))).toEqual([
    { name: "home", count: 2 },
    { name: "hob", count: 1 },
    { name: "shopping", count: 1 },
  ])
})
