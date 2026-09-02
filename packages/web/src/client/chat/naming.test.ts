/**
 * How the two halves of the `@` list share eight rows — `./naming.ts`'s budget,
 * which is the only thing in this feature that is neither matcher's.
 *
 * The vault below is deliberately lopsided: nine files whose names all start
 * with the query, and nine nodes whose titles do. Nothing else can produce the
 * reserve's failure — a list where one kind fills every row and the other is
 * not on screen at all.
 */

import { expect, test } from "bun:test"

import type { NodeHit } from "@olai/surface"

import { offers } from "./naming.ts"

const FILES = Array.from({ length: 9 }, (_, at) => `notes/note-${at}.md`)

/** What the server would answer for a word — nine nodes whose titles start with
 *  it, situated under one parent, capped at the eight this list asks for
 *  (`../search/nodes.ts`). Handed in rather than matched here: which nodes a
 *  word means is the matcher's, and this file is about the BUDGET. */
const hits = (query: string): ReadonlyArray<NodeHit> =>
  Array.from({ length: 9 }, (_, at) => ({
    at: { kind: "node" as const, id: `note-${at}` as never },
    id: `note-${at}`,
    title: `note about ${at}`,
    file: "house.org",
    line: at + 2,
    path: ["notes"],
    see: undefined,
    after: undefined,
    matched: "title" as const,
  }) as NodeHit)
    .filter((hit) => `${hit.id} ${hit.title}`.includes(query))
    .slice(0, 8)

const kinds = (query: string): ReadonlyArray<string> =>
  offers(FILES, hits(query), query).map((offer) => `${offer.kind}:${offer.value}`)

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
  const folders = kinds("notes/")
  expect(folders.length).toBe(8)
  expect(folders.every((row) => row.startsWith("file:"))).toBe(true)
  // ...and the other way round: nothing in the directory is called `about`.
  const titled = kinds("about")
  expect(titled.length).toBe(8)
  expect(titled.every((row) => row.startsWith("node:"))).toBe(true)
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
  const node = offers(FILES, hits("note-3"), "about 3")[0]
  expect(node).toEqual({
    kind: "node",
    section: "nodes",
    value: "note-3",
    label: "note about 3",
    // The label is a title and renders as one — the outline it is written in
    // rides the row so the menu can draw it (`CompletionMenu`'s `RowLabel`).
    from: "house.org",
    // The `·` is the PLACE's and nothing else's: the id and the place are two
    // facts, and one glyph doing both jobs on one line leaves a reader working
    // out which dots are boundaries and which are ancestry.
    hint: "@note-3 — notes",
  })
})

test("the file rows are what they always were: the name, then its folder", () => {
  expect(offers(FILES, [], "note-7.md")[0]).toEqual({
    kind: "file",
    section: "files",
    value: "notes/note-7.md",
    label: "note-7.md",
    hint: "notes",
  })
})

test("the file half answers before the node half has arrived", () => {
  // The nodes are a debounce and a round trip away since `search-server-side`,
  // and the files are here: an `@` typed into a panel that is already open
  // offers what this tab can answer at once rather than waiting for the wire.
  expect(offers(FILES, [], "note-2").map((offer) => offer.value))
    .toEqual(["notes/note-2.md"])
})
