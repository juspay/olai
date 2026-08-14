import { expect, test } from "bun:test"

import type { SearchHit } from "@olai/surface"

import { nodePlace } from "./place.ts"

const hit = (over: Partial<SearchHit> = {}): SearchHit => ({
  id: "hinges",
  title: "pick the hinges",
  file: "house.jsonl",
  line: 6,
  path: ["kitchen remodel #home", "install the cabinets"],
  matched: "title",
  ...over,
})

test("the place reads NEAREST ancestor first, so a truncation keeps what situates the node", () => {
  expect(nodePlace(hit())).toBe("install the cabinets · kitchen remodel #home")
})

test("a node at the top level is placed by its file", () => {
  expect(nodePlace(hit({ path: [] }))).toBe("house.jsonl")
})

test("a semantic hit wears ≈, because the words are NOT in it", () => {
  // The reader is owed the difference between evidence and resemblance: an
  // exact hit can be checked against the node, a `meaning` hit is the index's
  // opinion. Every door draws this one string, so the marker cannot appear on
  // one face and not another.
  expect(nodePlace(hit({ matched: "meaning" }))).toBe(
    "≈ install the cabinets · kitchen remodel #home",
  )
  expect(nodePlace(hit({ matched: "meaning", path: [] }))).toBe("≈ house.jsonl")
})

test("every exact match wears nothing", () => {
  for (const matched of ["title", "id", "tag", "desc"] as const) {
    expect(nodePlace(hit({ matched })).startsWith("≈")).toBe(false)
  }
})
