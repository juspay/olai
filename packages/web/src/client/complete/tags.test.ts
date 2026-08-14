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
import { nodesOf } from "@olai/format/testlib"

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
