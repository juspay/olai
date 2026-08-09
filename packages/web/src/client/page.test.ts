import { derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { only } from "./narrow.ts"
import { outlineOf, type Page, pageOf } from "./page.ts"
import type { Route } from "./routes.ts"

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
  located("house.jsonl", 3, {
    id: "herbs-here",
    parent: "kitchen",
    ord: "a1",
    mirror: "herbs",
  }),
  located("garden.jsonl", 1, { id: "garden", ord: "a0", title: "garden" }),
  located("garden.jsonl", 2, { id: "herbs", parent: "garden", ord: "a0", title: "herbs" }),
])
const FILES = ["garden.jsonl", "house.jsonl"]

const pageAt = (route: Route, files = FILES): Page => pageOf(SET, files, route)

/** The ids a page's own rows start from — an outline page carries what it
 *  draws, so this is what its screen would show. */
const roots = (page: Page): ReadonlyArray<string> =>
  only(page, "outline")?.rows.map((row) => row.at.node.id) ?? []

test("a bare `/` opens the first outline found", () => {
  const page = pageAt({ kind: "outline", file: null })
  expect(only(page, "outline")?.file).toBe("garden.jsonl")
  expect(roots(page)).toEqual(["garden"])
})

test("a named outline opens that one, with its own rows", () => {
  const page = pageAt({ kind: "outline", file: "house.jsonl" })
  expect(only(page, "outline")?.file).toBe("house.jsonl")
  expect(roots(page)).toEqual(["kitchen"])
})

// The two nothings are decided HERE rather than by a view counting files, so
// the screen that says them has one thing to say and no reasoning to do.
test("an outline the directory does not have is a nothing that names it", () => {
  expect(pageAt({ kind: "outline", file: "shed.jsonl" })).toEqual({
    kind: "nothing",
    requested: "shed.jsonl",
  })
})

test("a directory with no outlines at all is the other nothing", () => {
  expect(pageAt({ kind: "outline", file: "shed.jsonl" }, [])).toEqual({
    kind: "nothing",
    requested: null,
  })
  expect(pageAt({ kind: "outline", file: null }, [])).toEqual({
    kind: "nothing",
    requested: null,
  })
})

// ── which sidebar entry lights up ──────────────────────────────────────

test("the open outline is the one the page is of", () => {
  expect(outlineOf(pageAt({ kind: "outline", file: "house.jsonl" }))).toBe("house.jsonl")
})

// The point of asking the model rather than the URL: `/n/herbs-here` is a
// mirror living in house.jsonl, and the page it opens is in garden.jsonl.
test("a zoomed node lights up the file its CANONICAL record is in", () => {
  expect(outlineOf(pageAt({ kind: "node", id: "herbs-here" }))).toBe("garden.jsonl")
  expect(outlineOf(pageAt({ kind: "node", id: "install" }))).toBe("house.jsonl")
})

test("a page that names no node lights up nothing", () => {
  expect(outlineOf(pageAt({ kind: "node", id: "nope" }))).toBeUndefined()
  expect(outlineOf(pageAt({ kind: "outline", file: "shed.jsonl" }))).toBeUndefined()
})
