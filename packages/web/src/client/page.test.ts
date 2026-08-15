import type { BrokenFile } from "@olai/format"
import { derive, type Located } from "@olai/format"
import { expect, test } from "bun:test"

import { only } from "./narrow.ts"
import { fileOf, type Page, pageOf, rowsFor } from "./page.ts"
import type { Route } from "./routes.ts"

const located = (file: string, line: number, node: Located["node"]): Located => ({
  file,
  line,
  node,
})

const SET = derive([
  located("house.olai", 1, { id: "kitchen", ord: "a0", title: "kitchen" }),
  located("house.olai", 2, {
    id: "install",
    parent: "kitchen",
    ord: "a0",
    title: "install",
    props: { date: "2026-08-10" },
  }),
  located("house.olai", 3, {
    id: "herbs-here",
    parent: "kitchen",
    ord: "a1",
    mirror: "herbs",
  }),
  located("garden.olai", 1, { id: "garden", ord: "a0", title: "garden" }),
  located("garden.olai", 2, {
    id: "herbs",
    parent: "garden",
    ord: "a0",
    title: "herbs",
    props: { date: "2026-08-10T09:00" },
  }),
])
const FILES = ["garden.olai", "house.olai"]
/** The paths, the way the app holds them: a document's TEXT travels to the tab
 *  that opens one, so it is no business of the page model.
 *
 *  Two of them are about the day arm below: one named for a date, which IS that
 *  day's note, and one merely naming a date, which is a document about a day
 *  and nobody's note. */
const DOCUMENTS: ReadonlyArray<string> = [
  "notes/finishes.md",
  "Daily/2026-08-10.md",
  "notes/2026-08-10-recap.md",
]

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
): Page => pageOf(SET, { files, documents: DOCUMENTS, broken }, route, TODAY)

/** The ids a page's rows start from — what its screen would show. */
const roots = (page: Page): ReadonlyArray<string> =>
  rowsFor(SET, page).map((row) => row.at.node.id)

test("a bare `/` opens the first outline found", () => {
  const page = pageAt({ kind: "outline", file: null })
  expect(only(page, "outline")?.file).toBe("garden.olai")
  expect(roots(page)).toEqual(["garden"])
})

test("a named outline opens that one, with its own rows", () => {
  const page = pageAt({ kind: "outline", file: "house.olai" })
  expect(only(page, "outline")?.file).toBe("house.olai")
  expect(roots(page)).toEqual(["kitchen"])
})

// The two nothings are decided HERE rather than by a view counting files, so
// the screen that says them has one thing to say and no reasoning to do.
test("an outline the directory does not have is a nothing that names it", () => {
  expect(pageAt({ kind: "outline", file: "shed.olai" })).toEqual({
    kind: "nothing",
    sought: "outline",
    requested: "shed.olai",
  })
})

test("a directory with no outlines at all is the other nothing", () => {
  expect(pageAt({ kind: "outline", file: "shed.olai" }, [])).toEqual({
    kind: "nothing",
    sought: "outline",
    requested: null,
  })
  expect(pageAt({ kind: "outline", file: null }, [])).toEqual({
    kind: "nothing",
    sought: "outline",
    requested: null,
  })
})

// ── documents ──────────────────────────────────────────────────────────

// A document is a page of the set like any other, and what this model settles
// is that the address names one the directory HAS. The body is read by the
// page that draws it, one per-key subscription, so a corpus of thousands is
// thousands of paths here and one body on screen.
test("a document route opens that document, by path", () => {
  const page = pageAt({ kind: "document", file: "notes/finishes.md" })
  expect(only(page, "document")?.file).toBe("notes/finishes.md")
})

// The same two-nothings rule as an outline's, and it says which kind was being
// looked for: "no such document" and "no such outline" send a reader to two
// different places.
test("a document the directory does not have is a nothing that names it", () => {
  expect(pageAt({ kind: "document", file: "gone.md" })).toEqual({
    kind: "nothing",
    sought: "document",
    requested: "gone.md",
  })
})

// ── which sidebar entry lights up ──────────────────────────────────────

test("the open outline is the one the page is of", () => {
  expect(fileOf(pageAt({ kind: "outline", file: "house.olai" }))).toBe("house.olai")
})

// The point of asking the model rather than the URL: `/n/herbs-here` is a
// mirror living in house.olai, and the page it opens is in garden.olai.
test("a zoomed node lights up the file its CANONICAL record is in", () => {
  expect(fileOf(pageAt({ kind: "node", id: "herbs-here" }))).toBe("garden.olai")
  expect(fileOf(pageAt({ kind: "node", id: "install" }))).toBe("house.olai")
})

// A file that would not parse has no tree to draw, so its outline route is a
// different page — but it is still that file's page, and the sidebar says so.
test("an outline whose file did not parse is the broken page, not an empty one", () => {
  const unreadable: BrokenFile = {
    file: "house.olai",
    errors: [
      {
        code: "not-json",
        file: "house.olai",
        line: 2,
        message: "not JSON",
      },
    ],
  }
  const page = pageAt(
    { kind: "outline", file: "house.olai" },
    FILES,
    new Map([["house.olai", unreadable]]),
  )
  expect(only(page, "broken")?.file).toEqual(unreadable)
  expect(fileOf(page)).toBe("house.olai")
})

test("an open document lights up its own entry", () => {
  expect(fileOf(pageAt({ kind: "document", file: "notes/finishes.md" })))
    .toBe("notes/finishes.md")
})

test("a page that names no node lights up nothing", () => {
  expect(fileOf(pageAt({ kind: "node", id: "nope" }))).toBeUndefined()
  expect(fileOf(pageAt({ kind: "outline", file: "shed.olai" }))).toBeUndefined()
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
// place (docs/roadmap.olai, resolved 2026-08-09).
test("a day collects the dated nodes of every outline", () => {
  const page = pageAt({ kind: "day", date: "2026-08-10" })
  expect(only(page, "day")?.groups.map((group) => group.file)).toEqual([
    "garden.olai",
    "house.olai",
  ])
})

test("a day with nothing dated it is an empty day, not a nothing", () => {
  const page = pageAt({ kind: "day", date: "2026-08-11" })
  expect(only(page, "day")?.date).toBe("2026-08-11")
  expect(only(page, "day")?.groups).toEqual([])
  expect(only(page, "day")?.notes).toEqual([])
})

// The day's other half: a document named for the date is that day's note, and
// it JOINS the query's answer rather than replacing it — the groups above are
// unchanged by its being there. A document merely NAMING the date is not one.
test("a day carries the documents named for it, beside its dated nodes", () => {
  const page = pageAt({ kind: "day", date: "2026-08-10" })
  expect(only(page, "day")?.notes).toEqual(["Daily/2026-08-10.md"])
  expect(only(page, "day")?.groups.length).toBe(2)
})

// `/today` names no date, so the page model is told which day it is. That is
// the whole of the difference: the two routes are one page.
test("`/today` is the day it is", () => {
  expect(pageAt({ kind: "today" })).toEqual(pageAt({ kind: "day", date: TODAY }))
})

// A day belongs to no outline — it crosses all of them — so nothing in the
// sidebar's list is the page you are on. Which day the calendar fills in is
// the page's own `date`, and `/today` is where that is worth saying: the route
// spells no date, and the page it opened does.
test("a day lights up no outline, and says which day it turned out to be", () => {
  expect(fileOf(pageAt({ kind: "day", date: "2026-08-10" }))).toBeUndefined()
  expect(only(pageAt({ kind: "today" }), "day")?.date).toBe(TODAY)
})

// ── the agenda ─────────────────────────────────────────────────────────

// The forward half of the same question: no file, no node, and — since the
// directory column marks what is owed on every screen — no sections either. The
// reading is the app's one `agendaOf` (`App.tsx`), so what this model settles is
// the DAY alone: the address spells no date, and a page saying what is overdue
// owes the reader the day it is overdue as of.
test("the agenda is answered for today, and says which day that was", () => {
  const page = pageAt({ kind: "agenda" })
  expect(only(page, "agenda")?.date).toBe(TODAY)
  expect(only(page, "agenda")).toEqual({ kind: "agenda", date: TODAY })
})

test("the agenda lights up no outline, and draws no tree", () => {
  expect(fileOf(pageAt({ kind: "agenda" }))).toBeUndefined()
  expect(rowsFor(SET, pageAt({ kind: "agenda" }))).toEqual([])
})

// ── the trash ──────────────────────────────────────────────────────────

/** The same directory once something has been archived: the archives are in
 *  the file list like anything else, and only this model treats them apart. */
const WITH_ARCHIVES = ["Archive.olai", ...FILES, "wing/Archive.olai"]

test("the trash is every archive the directory holds, and an empty one is a page", () => {
  expect(pageAt({ kind: "trash" }, WITH_ARCHIVES)).toEqual({
    kind: "trash",
    files: ["Archive.olai", "wing/Archive.olai"],
  })
  // Nothing archived yet — the archive tool creates the file on first use, so
  // an absent archive is an empty trash, never a missing page.
  expect(pageAt({ kind: "trash" })).toEqual({ kind: "trash", files: [] })
})

test("an archive's own address opens the trash — it is not a place you edit", () => {
  expect(pageAt({ kind: "outline", file: "Archive.olai" }, WITH_ARCHIVES)).toEqual({
    kind: "trash",
    files: ["Archive.olai", "wing/Archive.olai"],
  })
})

test("a bare `/` never opens an archive, even one that sorts first", () => {
  expect(pageAt({ kind: "outline", file: null }, WITH_ARCHIVES))
    .toEqual({ kind: "outline", file: "garden.olai" })
})

test("the trash lights up no outline, and holds no row store", () => {
  expect(fileOf(pageAt({ kind: "trash" }, WITH_ARCHIVES))).toBeUndefined()
  expect(rowsFor(SET, pageAt({ kind: "trash" }, WITH_ARCHIVES))).toEqual([])
})

// A day draws no TREE. It is a list of nodes from all over the set, each with
// its own ancestry — so the row store, which holds whichever tree is on screen,
// holds nothing while one is open.
test("a page with nothing to draw has no rows", () => {
  expect(rowsFor(SET, pageAt({ kind: "node", id: "nope" }))).toEqual([])
  expect(rowsFor(SET, pageAt({ kind: "outline", file: "shed.olai" }))).toEqual([])
  expect(rowsFor(SET, pageAt({ kind: "day", date: "2026-08-10" }))).toEqual([])
  expect(rowsFor(SET, undefined)).toEqual([])
})
