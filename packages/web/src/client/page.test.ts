/**
 * The two ends of the page seam that are still the browser's: the QUESTION a
 * route turns into, and the reading folded into the shape a filter narrows.
 *
 * WHICH PAGE AN ADDRESS NAMES is not here any more, and that is PR 10 of
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`: it was a pure function over the
 * tab's copy of every record in the directory, and it is now a reading the
 * server sends. Every claim that model made is made in `@olai/format`'s
 * `page.test.ts`, over the same shape of fixture, beside the parity that says
 * the answer equals what a browser would have derived.
 */

import { addressOf } from "@olai/format"
import type { Agenda, Row, Shown } from "@olai/format"
import { expect, test } from "bun:test"

import { drawnBy, fileOf, opensAt, requestFor } from "./page.ts"
import { atElement, atFile, atNode, defineAppRoute, HOME_ROUTE } from "./routes.ts"

const TODAY = "2026-08-10"

// ── what the server is asked ───────────────────────────────────────────

test("an address goes over as the address the parser read", () => {
  expect(requestFor(atFile("house.olai")))
    .toEqual({ kind: "at", address: addressOf("house.olai", null) })
  expect(requestFor(HOME_ROUTE)).toEqual({ kind: "at", address: null })
})

test("a plugin route whose tenant vanished is not core's front page", () => {
  const plugin = defineAppRoute({
    claims: [{ kind: "exact", path: "/plugin" }],
    parse: () => "plugin",
    href: () => "/plugin" as const,
    breadcrumb: () => "plugin",
    narrowable: false,
    request: () => ({ kind: "trash" } as const),
    stream: { use: () => () => undefined },
  })
  expect(requestFor(plugin.to("plugin"))).toBeNull()
})

// A `?q=` is a second question with a door of its own (`filter/asking.ts`), so
// it must not reach this one — a page reading that carried the query would be
// the whole page re-asked on every keystroke.
test("the narrowing is dropped: it is not part of which page this is", () => {
  expect(requestFor({ ...atFile("house.olai"), filter: "is:todo" }))
    .toEqual(requestFor(atFile("house.olai")))
  expect(requestFor({ kind: "trash", filter: "is:todo" })).toEqual({ kind: "trash" })
})

// The ROUTE keeps the row — `landingOf` answers from it — and the request
// keeps the FILE, because the outline page the row lands in is the same
// outline its file spelled. Sent whole, a link to a row would re-ask the page
// for each row of it.
test("a row is the outline it sits in: its element is a landing, not a page", () => {
  expect(requestFor(atElement("house.olai", "install")))
    .toEqual(requestFor(atFile("house.olai")))
})

// ── which sidebar entry lights up ──────────────────────────────────────

const ROW: Row = {
  at: { file: "garden.olai", line: 1, node: { id: "herbs", ord: "a0", title: "herbs" } },
  blocked: [],
  under: 0,
  key: "/herbs",
  children: [],
  kind: "node",
  shows: { file: "garden.olai", line: 1, node: { id: "herbs", ord: "a0", title: "herbs" } },
}

const OUTLINE: Shown = { kind: "outline", file: "house.olai", rows: [ROW] }

test("the open outline is the one the page is of", () => {
  expect(fileOf(OUTLINE)).toBe("house.olai")
  expect(fileOf({ kind: "document", file: "notes/finishes.md", referrers: [], props: {} }))
    .toBe("notes/finishes.md")
})

// The point of asking the reading rather than the URL: `/#herbs-here` may be a
// mirror living in house.olai, and the page it opens is in garden.olai.
test("a zoomed node lights up the file its CANONICAL record is in", () => {
  expect(fileOf({
    kind: "node",
    backlinks: [],
    zoomed: {
      kind: "node",
      shows: ROW.at as never,
      blocked: [],
      trail: [],
      children: [],
      under: 0,
    },
  })).toBe("garden.olai")
})

test("a page that names no node lights up nothing", () => {
  expect(fileOf({ kind: "agenda", date: TODAY, agenda: NOTHING_OWED })).toBeUndefined()
  expect(fileOf({ kind: "nothing", sought: "outline", requested: "shed.olai" }))
    .toBeUndefined()
})

// ── what the page DRAWS, which is what a filter narrows ────────────────

const NOTHING_OWED: Agenda = { overdue: [], today: [], upcoming: [] }

test("an outline and a zoomed node are one shape: the tree they draw", () => {
  expect(drawnBy(OUTLINE)).toEqual({ kind: "tree", rows: [ROW] })
  // A zoomed page's rows are its `children` — the same array `zoom` already
  // walked, rather than the walk run a second time beside it.
  expect(drawnBy({
    kind: "node",
    backlinks: [],
    zoomed: {
      kind: "node",
      shows: ROW.at as never,
      blocked: [],
      trail: [],
      children: [ROW],
      under: 0,
    },
  })).toEqual({ kind: "tree", rows: [ROW] })
})

test("a day and the agenda draw what they were answered with", () => {
  expect(drawnBy({ kind: "day", date: TODAY, groups: [], notes: ["Daily/x.md"] }))
    .toEqual({ kind: "day", groups: [], notes: ["Daily/x.md"] })
  expect(drawnBy({ kind: "agenda", date: TODAY, agenda: NOTHING_OWED }))
    .toEqual({ kind: "agenda", agenda: NOTHING_OWED })
})

test("the trash draws its groups, and keeps the FILES beside them", () => {
  // Not the same list: what is drawn narrows with the query, and whether a pile
  // is worth a file heading is a fact about the directory.
  expect(drawnBy({
    kind: "trash",
    files: ["_olai/Trash.olai"],
    groups: [],
    records: 3,
  })).toEqual({ kind: "trash", files: ["_olai/Trash.olai"], groups: [] })
})

test("a page a query has nothing to say about draws none of it", () => {
  expect(drawnBy({ kind: "document", file: "notes/finishes.md", referrers: [], props: {} }))
    .toEqual({ kind: "none" })
  expect(drawnBy({ kind: "nothing", sought: "outline", requested: null }))
    .toEqual({ kind: "none" })
  // …and the frame before the reading has arrived at all, which is the same
  // nothing rather than a state of its own.
  expect(drawnBy(undefined)).toEqual({ kind: "none" })
})

// ── where a path of this vault opens ───────────────────────────────────

/** The directory as this question is asked of it: the PATHS, in the order the
 *  directory holds them (`../client/directory.ts`). It was a list of faces
 *  until `perf-faces-broken-walk`, and every element of it was read for its
 *  `path` and nothing else. */
const SERVED = ["house.olai", "notes/finishes.md"]

test("a path the directory holds opens at its own route; one it does not opens nowhere", () => {
  expect(opensAt(SERVED, "house.olai")).toEqual(atFile("house.olai"))
  expect(opensAt(SERVED, "shed.olai")).toBeUndefined()
})

test("a fragment is read by the grammar that would have written it", () => {
  // In a BODY it is a heading — the ids a rendered document has.
  expect(opensAt(SERVED, "notes/finishes.md", "install"))
    .toEqual(atElement("notes/finishes.md", "install"))
  // After an OUTLINE it is a node, because an outline's places are node ids —
  // which is the grammar's own answer (`@olai/format`'s `address.ts`), asked
  // here rather than re-decided.
  expect(opensAt(SERVED, "house.olai", "install")).toEqual(atElement("house.olai", "install"))
})
