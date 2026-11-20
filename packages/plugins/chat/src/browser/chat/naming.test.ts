import { expect, test } from "bun:test"

import type { NodeHit } from "@olai/format"

import { offers } from "./naming.ts"

const FILES = Array.from({ length: 9 }, (_, at) => `notes/note-${at}.md`)

const hits = (query: string): ReadonlyArray<NodeHit> =>
  Array.from({ length: 9 }, (_, at) => ({
    at: { kind: "node" as const, id: `note-${at}` as never },
    id: `note-${at}`,
    title: `note about ${at}`,
    file: "house.olai",
    line: at + 2,
    path: ["notes"],
    pathIds: [],
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
  const folders = kinds("notes/")
  expect(folders.length).toBe(8)
  expect(folders.every((row) => row.startsWith("file:"))).toBe(true)
  const titled = kinds("about")
  expect(titled.length).toBe(8)
  expect(titled.every((row) => row.startsWith("node:"))).toBe(true)
})

test("a kind that answers short is not padded, and the other one grows", () => {
  const list = kinds("note-1")
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
    from: "house.olai",
    hint: "@note-3",
    place: { file: "house.olai", crumbs: [{ title: "notes" }] },
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
  expect(offers(FILES, [], "note-2").map((offer) => offer.value))
    .toEqual(["notes/note-2.md"])
})
