import type { BrokenFile } from "@olai/format"
import { derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { only } from "./narrow.ts"
import { outlineOf, type Page, pageOf, rowsFor } from "./page.ts"
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

/** No file in these fixtures failed to parse — the broken arm has its own
 *  cases below, where one did. */
const READABLE: ReadonlyMap<string, BrokenFile> = new Map()

const pageAt = (
  route: Route,
  files = FILES,
  broken = READABLE,
): Page => pageOf(SET, files, broken, route)

/** The ids a page's rows start from — what its screen would show. */
const roots = (page: Page): ReadonlyArray<string> =>
  rowsFor(SET, page).map((row) => row.at.node.id)

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

// A file that would not parse has no tree to draw, so its outline route is a
// different page — but it is still that file's page, and the sidebar says so.
test("an outline whose file did not parse is the broken page, not an empty one", () => {
  const unreadable: BrokenFile = {
    file: "house.jsonl",
    errors: [
      {
        code: "not-json",
        file: "house.jsonl",
        line: 2,
        message: "not JSON",
      },
    ],
  }
  const page = pageAt(
    { kind: "outline", file: "house.jsonl" },
    FILES,
    new Map([["house.jsonl", unreadable]]),
  )
  expect(only(page, "broken")?.file).toEqual(unreadable)
  expect(outlineOf(page)).toBe("house.jsonl")
})

test("a page that names no node lights up nothing", () => {
  expect(outlineOf(pageAt({ kind: "node", id: "nope" }))).toBeUndefined()
  expect(outlineOf(pageAt({ kind: "outline", file: "shed.jsonl" }))).toBeUndefined()
})

// A zoomed page draws the node's children, and it draws them FRESH — the row
// store reconciles into whatever it is handed, and reconciling writes into the
// objects, so a cached array would come back filtered the next time it was
// asked for.
test("a zoomed node's rows are its children, built new every time", () => {
  const page = pageAt({ kind: "node", id: "kitchen" })
  expect(roots(page)).toEqual(["install", "herbs-here"])
  expect(rowsFor(SET, page)[0]).not.toBe(rowsFor(SET, page)[0]!)
})

test("a page with nothing to draw has no rows", () => {
  expect(rowsFor(SET, pageAt({ kind: "node", id: "nope" }))).toEqual([])
  expect(rowsFor(SET, pageAt({ kind: "outline", file: "shed.jsonl" }))).toEqual([])
  expect(rowsFor(SET, undefined)).toEqual([])
})
