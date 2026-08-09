import { derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { outlineOf, pageOf } from "./page.ts"

const located = (file: string, line: number, node: Located["node"]): Located => ({
  file,
  line,
  node,
})

const SET = derive([
  located("house.jsonl", 1, { id: "kitchen", ord: "a0", title: "kitchen" }),
  located("house.jsonl", 2, {
    id: "install",
    parent: "kitchen",
    ord: "a0",
    title: "install",
  }),
  located("house.jsonl", 3, { id: "herbs-here", parent: "kitchen", ord: "a1", mirror: "herbs" }),
  located("garden.jsonl", 1, { id: "garden", ord: "a0", title: "garden" }),
  located("garden.jsonl", 2, { id: "herbs", parent: "garden", ord: "a0", title: "herbs" }),
])
const FILES = ["garden.jsonl", "house.jsonl"]

test("a bare `/` opens the first outline found", () => {
  expect(pageOf(SET, FILES, { kind: "outline", file: null })).toEqual({
    kind: "outline",
    file: "garden.jsonl",
  })
})

test("a named outline opens that one", () => {
  expect(pageOf(SET, FILES, { kind: "outline", file: "house.jsonl" })).toEqual({
    kind: "outline",
    file: "house.jsonl",
  })
})

// The two nothings are decided HERE rather than by a view counting files, so
// the screen that says them has one thing to say and no reasoning to do.
test("an outline the directory does not have is a nothing that names it", () => {
  expect(pageOf(SET, FILES, { kind: "outline", file: "shed.jsonl" })).toEqual({
    kind: "nothing",
    requested: "shed.jsonl",
  })
})

test("a directory with no outlines at all is the other nothing", () => {
  expect(pageOf(SET, [], { kind: "outline", file: "shed.jsonl" })).toEqual({
    kind: "nothing",
    requested: null,
  })
  expect(pageOf(SET, [], { kind: "outline", file: null })).toEqual({
    kind: "nothing",
    requested: null,
  })
})

// ── which sidebar entry lights up ──────────────────────────────────────

test("the open outline is the one the page is of", () => {
  expect(outlineOf(pageOf(SET, FILES, { kind: "outline", file: "house.jsonl" })))
    .toBe("house.jsonl")
})

// The point of asking the model rather than the URL: `/n/herbs-here` is a
// mirror living in house.jsonl, and the page it opens is in garden.jsonl.
test("a zoomed node lights up the file its CANONICAL record is in", () => {
  expect(outlineOf(pageOf(SET, FILES, { kind: "node", id: "herbs-here" })))
    .toBe("garden.jsonl")
  expect(outlineOf(pageOf(SET, FILES, { kind: "node", id: "install" })))
    .toBe("house.jsonl")
})

test("a page that names no node lights up nothing", () => {
  expect(outlineOf(pageOf(SET, FILES, { kind: "node", id: "nope" }))).toBeUndefined()
  expect(outlineOf(undefined)).toBeUndefined()
})
