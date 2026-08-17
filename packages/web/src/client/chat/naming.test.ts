/**
 * How the two halves of the `@` list share eight rows — `./naming.ts`'s budget,
 * which is the only thing in this feature that is neither matcher's.
 *
 * The vault below is deliberately lopsided: nine files whose names all start
 * with the query, and nine nodes whose titles do. Nothing else can produce the
 * reserve's failure — a list where one kind fills every row and the other is
 * not on screen at all.
 */

import { derive } from "@olai/format"
import { expect, test } from "bun:test"

import { offers } from "./naming.ts"

const FILES = Array.from({ length: 9 }, (_, at) => `notes/note-${at}.md`)

const SET = derive([
  { file: "house.olai", line: 1, node: { id: "top", ord: "a0", title: "notes" } },
  ...Array.from({ length: 9 }, (_, at) => ({
    file: "house.olai",
    line: at + 2,
    node: {
      id: `note-${at}`,
      parent: "top",
      ord: `a${at + 1}`,
      title: `note about ${at}`,
    },
  })),
])

const TODAY = "2026-08-13"

const kinds = (query: string): ReadonlyArray<string> =>
  offers(FILES, SET, query, TODAY).map((offer) => `${offer.kind}:${offer.value}`)

test("both kinds are offered, files first, four rows each", () => {
  const list = kinds("note")
  expect(list.length).toBe(8)
  expect(list.slice(0, 4).every((row) => row.startsWith("file:"))).toBe(true)
  expect(list.slice(4).every((row) => row.startsWith("node:"))).toBe(true)
})

test("a kind with nothing to offer gives its rows away", () => {
  // An id cannot hold a `/`, so `notes/` is a folder and nothing else — the
  // files take the whole list. This is the case a cap computed per half before
  // either had answered would have got wrong, since the file half stops walking
  // once its share is full and could not have grown back.
  expect(kinds("notes/").length).toBe(8)
  expect(kinds("notes/").every((row) => row.startsWith("file:"))).toBe(true)
  // ...and the other way round: nothing in the directory is called `about`.
  expect(kinds("about").every((row) => row.startsWith("node:"))).toBe(true)
  expect(kinds("about").length).toBe(8)
})

test("a kind that answers short is not padded, and the other one grows", () => {
  const list = kinds("note-1")
  // One file (`notes/note-1.md`) and one node (`note about 1`, by its id).
  expect(list).toEqual(["file:notes/note-1.md", "node:note-1"])
})

test("a query nothing holds is an empty list, which is what draws no box", () => {
  expect(kinds("nothing-is-called-this")).toEqual([])
})

test("the node rows say what they write, then where they are", () => {
  const node = offers(FILES, SET, "about 3", TODAY)[0]
  expect(node).toEqual({
    kind: "node",
    value: "note-3",
    label: "note about 3",
    hint: "@note-3 · notes",
  })
})

test("the file rows are what they always were: the name, then its folder", () => {
  expect(offers(FILES, SET, "note-7.md", TODAY)[0]).toEqual({
    kind: "file",
    value: "notes/note-7.md",
    label: "note-7.md",
    hint: "notes",
  })
})

test("a tab with no indexes yet still completes a path", () => {
  // The first frame draws nothing that needs the derivation (`../derived.tsx`),
  // and an `@` typed into a panel that is already open must not wait for one.
  expect(offers(FILES, undefined, "note-2", TODAY).map((offer) => offer.value))
    .toEqual(["notes/note-2.md"])
})
