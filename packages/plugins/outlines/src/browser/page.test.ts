import { TEST_CLAIMS } from "@olai/format/testlib"
import { addressOf } from "@olai/format"
import type { Agenda, Row, Shown } from "@olai/format"
import { expect, test } from "bun:test"

import { drawnBy, fileOf, requestFor } from "./page.ts"
import { atElement, atFile, atNode, defineAppRoute, HOME_ROUTE } from "olai-plugin-navigation/routes"

const TODAY = "2026-08-10"

test("an address goes over as the address the parser read", () => {
  expect(requestFor(atFile("house.olai")))
    .toEqual({ kind: "at", address: addressOf(TEST_CLAIMS, "house.olai", null) })
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

test("the narrowing is dropped: it is not part of which page this is", () => {
  expect(requestFor({ ...atFile("house.olai"), filter: "is:todo" }))
    .toEqual(requestFor(atFile("house.olai")))
  expect(requestFor({ kind: "trash", filter: "is:todo" })).toEqual({ kind: "trash" })
})

test("a row is the outline it sits in: its element is a landing, not a page", () => {
  expect(requestFor(atElement(TEST_CLAIMS, "house.olai", "install")))
    .toEqual(requestFor(atFile("house.olai")))
})

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

const NOTHING_OWED: Agenda = { overdue: [], today: [], upcoming: [] }

test("an outline and a zoomed node are one shape: the tree they draw", () => {
  expect(drawnBy(OUTLINE)).toEqual({ kind: "tree", rows: [ROW] })
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
  expect(drawnBy(undefined)).toEqual({ kind: "none" })
})

