import type { BrokenFile } from "@olai/format"
import { derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { only } from "./narrow.ts"
import { openDay, outlineOf, type Page, pageOf, rowsFor } from "./page.ts"
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
    date: "2026-08-10",
  }),
  located("house.jsonl", 3, {
    id: "herbs-here",
    parent: "kitchen",
    ord: "a1",
    mirror: "herbs",
  }),
  located("garden.jsonl", 1, { id: "garden", ord: "a0", title: "garden" }),
  located("garden.jsonl", 2, {
    id: "herbs",
    parent: "garden",
    ord: "a0",
    title: "herbs",
    date: "2026-08-10T09:00",
  }),
])
const FILES = ["garden.jsonl", "house.jsonl"]

/** What day it is, for the arm that has to be told. Fixed, because a page
 *  model that read a clock would be a page model whose tests expire. */
const TODAY = "2026-08-10"

/** No file in these fixtures failed to parse — the broken arm has its own
 *  cases below, where one did. */
const READABLE: ReadonlyMap<string, BrokenFile> = new Map()

const pageAt = (
  route: Route,
  files = FILES,
  broken = READABLE,
): Page => pageOf(SET, files, broken, route, TODAY)

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

// ── the day ────────────────────────────────────────────────────────────

// A day is not a file and not a node: it collects whatever is dated it, from
// every outline at once, which is what makes the journal a query rather than a
// place (docs/roadmap.jsonl, resolved 2026-08-09).
test("a day collects the dated nodes of every outline", () => {
  const page = pageAt({ kind: "day", date: "2026-08-10" })
  expect(only(page, "day")?.groups.map((group) => group.file)).toEqual([
    "garden.jsonl",
    "house.jsonl",
  ])
})

test("a day with nothing dated it is an empty day, not a nothing", () => {
  const page = pageAt({ kind: "day", date: "2026-08-11" })
  expect(only(page, "day")?.date).toBe("2026-08-11")
  expect(only(page, "day")?.groups).toEqual([])
})

// `/today` names no date, so the page model is told which day it is. That is
// the whole of the difference: the two routes are one page.
test("`/today` is the day it is", () => {
  expect(pageAt({ kind: "today" })).toEqual(pageAt({ kind: "day", date: TODAY }))
})

// A day belongs to no outline — it crosses all of them — so nothing in the
// sidebar's list is the page you are on.
test("a day lights up no outline, and is the day the calendar fills in", () => {
  const page = pageAt({ kind: "day", date: "2026-08-10" })
  expect(outlineOf(page)).toBeUndefined()
  expect(openDay(page)).toBe("2026-08-10")
  expect(openDay(pageAt({ kind: "today" }))).toBe(TODAY)
  expect(openDay(pageAt({ kind: "outline", file: "house.jsonl" }))).toBeUndefined()
  expect(openDay(undefined)).toBeUndefined()
})

// A day draws no TREE. It is a list of nodes from all over the set, each with
// its own ancestry — so the row store, which holds whichever tree is on screen,
// holds nothing while one is open.
test("a page with nothing to draw has no rows", () => {
  expect(rowsFor(SET, pageAt({ kind: "node", id: "nope" }))).toEqual([])
  expect(rowsFor(SET, pageAt({ kind: "outline", file: "shed.jsonl" }))).toEqual([])
  expect(rowsFor(SET, pageAt({ kind: "day", date: "2026-08-10" }))).toEqual([])
  expect(rowsFor(SET, undefined)).toEqual([])
})
