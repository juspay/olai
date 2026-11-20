import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { derive, type Derived, tagText } from "./derive.ts"
import { nodesOf, nodesOfFiles } from "./fixtures.testlib.ts"
import {
  completingTags,
  type TagCompletion,
  type TagsRequest,
  type TagUse,
  vocabularyOf,
} from "./vocabulary.ts"

const set = (contents: string) => derive(TEST_CLAIMS, nodesOf(contents))

const written = (tags: ReadonlyArray<TagUse>): ReadonlyArray<string> =>
  tags.map((tag) => tagText({ sigil: tag.sigil, tag: tag.name }))

const asking = (sigil: TagsRequest["sigil"], query: string): TagsRequest => ({
  sigil,
  query,
  limit: 8,
})

const offered = (
  sigil: TagsRequest["sigil"],
  rows: ReadonlyArray<TagCompletion>,
): ReadonlyArray<string> => rows.map((row) => tagText({ sigil, tag: row.name }))

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
  expect(written(vocabularyOf(HOUSE))).toEqual([
    "@alice",
    "#home",
    "#hob",
    "#shopping",
  ])
})

test("a tag is counted once per node that writes it, mirrors excluded", () => {
  const home = vocabularyOf(HOUSE).find((tag) => tag.name === "home")
  expect(home?.count).toBe(2)
})

test("a record writing one tag twice is one vote for it", () => {
  const twice = set(`{"id":"a","ord":"a0","title":"#home and #home","desc":"still #home"}`)
  expect(vocabularyOf(twice).find((tag) => tag.name === "home")?.count).toBe(1)
})

test("a tag written in a note is offered, and counted", () => {
  const noted = set(
    `{"id":"a","ord":"a0","title":"the kitchen"}\n` +
      `{"id":"b","ord":"a1","title":"the shed","desc":"see the #hob about this"}`,
  )
  expect(written(vocabularyOf(noted))).toEqual(["#hob"])
  expect(vocabularyOf(noted)[0]?.count).toBe(1)
})

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

test("what is in the trash is not counted, and a tag only it used is not offered", () => {
  const withArchive = derive(TEST_CLAIMS, nodesOfFiles({
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
  const withLeftover = derive(TEST_CLAIMS, nodesOfFiles({
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

test("the vocabulary is counted once per derivation and handed back after that", () => {
  expect(vocabularyOf(HOUSE)).toBe(vocabularyOf(HOUSE))
  expect(vocabularyOf({ ...HOUSE })).not.toBe(vocabularyOf(HOUSE))
})

test("the two sigils are two lists", () => {
  expect(matched(HOUSE, "@", "")).toEqual(["@alice"])
  expect(matched(HOUSE, "#", "")).toEqual(["#home", "#hob", "#shopping"])
})

test("a prefix beats a substring", () => {
  expect(matched(HOUSE, "#", "ho")).toEqual([
    "#home",
    "#hob",
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

test("an answer row is the name and the count, and nothing else", () => {
  expect(completingTags(HOUSE, asking("#", "ho"))).toEqual([
    { name: "home", count: 2 },
    { name: "hob", count: 1 },
    { name: "shopping", count: 1 },
  ])
})
