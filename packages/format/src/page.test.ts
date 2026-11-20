import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import { addressOf } from "./address.ts"
import { agendaOf } from "./agenda.ts"
import { referencesOf } from "./backlinks.ts"
import { dailyNotesOn, datedOn } from "./dates.ts"
import { derive, type Derived, nodesOf, rowsOf } from "./derive.ts"
import type { Document, Face } from "./document.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { DocumentPageRequest, FiledPageReading, FiledPageRequest, PageReading, type PageRequest, pageOf, samePageReading } from "./page.ts"
import { pointingOf } from "./pointing.ts"
import type { BrokenFile, OutlineSet } from "./set.ts"
import type { Reading } from "./validate.ts"
import { zoom } from "./zoom.ts"

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"kitchen remodel"}`,
  `{"id":"install","parent":"kitchen","ord":"a0","title":"install them","date":"2026-08-10","todo":true,"see":["herbs"],"desc":"after @herbs"}`,
  `{"id":"herbs-here","parent":"kitchen","ord":"a1","mirror":"herbs"}`,
  `{"id":"linky","parent":"kitchen","ord":"a2","title":"/#herbs"}`,
].join("\n")
const GARDEN = [
  `{"id":"garden","ord":"a0","title":"garden"}`,
  `{"id":"herbs","parent":"garden","ord":"a0","title":"the herb bed","date":"2026-08-10T09:00","todo":true}`,
  `{"id":"late","parent":"garden","ord":"a1","title":"late thing","date":"2026-08-01","todo":true}`,
].join("\n")

const RECORDS = nodesOfFiles({ "house.olai": HOUSE, "garden.olai": GARDEN })
const SET = derive(TEST_CLAIMS, RECORDS)

const TODAY = "2026-08-10"

const facesOf = (paths: ReadonlyArray<string>): ReadonlyArray<Face> =>
  paths.map((path) => ({ path, title: path, links: [], tags: [], props: {} }) as unknown as Face)

const FILES = ["garden.olai", "house.olai"]
const DOCUMENTS = [
  "notes/finishes.md",
  "Daily/2026-08-10.md",
  "notes/2026-08-10-recap.md",
]

const READABLE: ReadonlyArray<BrokenFile> = []

const readingAt = (
  derived: Derived,
  faces: ReadonlyArray<Face>,
  broken: ReadonlyArray<BrokenFile> = READABLE,
): Reading & { readonly outlineRow: string } => ({
  outlineRow: "outline-olai",
  claims: TEST_CLAIMS,
  set: { documents: faces, broken } as unknown as OutlineSet,
  derived,
  pointing: pointingOf(TEST_CLAIMS, faces as unknown as ReadonlyArray<Document>),
})

const readAt = (
  request: PageRequest,
  files = FILES,
  broken = READABLE,
  set = SET,
) => pageOf(readingAt(set, facesOf([...files, ...DOCUMENTS]), broken), request).shows

const at = (path: string, element: string | null = null): PageRequest => ({
  kind: "at",
  address: addressOf(TEST_CLAIMS, path, element)!,
})
const HOME: PageRequest = { kind: "at", address: null }
const node = (id: string): PageRequest => ({ kind: "at", address: addressOf(TEST_CLAIMS, "", id)! })

const roots = (shows: ReturnType<typeof readAt>): ReadonlyArray<string> =>
  shows.kind === "outline"
    ? shows.rows.map((row) => row.at.node.id)
    : shows.kind === "node" && shows.zoomed.kind === "node"
    ? shows.zoomed.children.map((row) => row.at.node.id)
    : []

test("the front page prefers ordinary outlines while convention files remain addressable", () => {
  const paths = ["_olai/Settings.olai", "house.olai"]
  expect(readAt(HOME, paths)).toMatchObject({ kind: "outline", file: "house.olai" })
  expect(readAt(at(paths[0]!), paths)).toMatchObject({ kind: "outline", file: paths[0] })
  expect(readAt(HOME, [paths[0]!])).toMatchObject({ kind: "outline", file: paths[0] })
})

test("a bare `/` opens the first outline found", () => {
  const shows = readAt(HOME)
  expect(shows.kind === "outline" ? shows.file : undefined).toBe("garden.olai")
  expect(roots(shows)).toEqual(["garden"])
})

test("a named outline opens that one, with its own rows", () => {
  const shows = readAt(at("house.olai"))
  expect(shows.kind === "outline" ? shows.file : undefined).toBe("house.olai")
  expect(roots(shows)).toEqual(["kitchen"])
})

test("a row address opens the outline that holds it", () => {
  const shows = readAt(at("house.olai", "kitchen"))
  expect(shows.kind === "outline" ? shows.file : undefined).toBe("house.olai")
  expect(roots(shows)).toEqual(["kitchen"])
})

test("a row of an outline the directory does not hold is a nothing that names it", () => {
  expect(readAt(at("shed.olai", "kitchen"))).toEqual({
    kind: "nothing",
    sought: "outline-olai",
    requested: "shed.olai",
  })
})

test("an outline the directory does not have is a nothing that names it", () => {
  expect(readAt(at("shed.olai"))).toEqual({
    kind: "nothing",
    sought: "outline-olai",
    requested: "shed.olai",
  })
})

test("a directory with no outlines at all is the other nothing", () => {
  const nothing = { kind: "nothing", sought: "outline-olai", requested: null } as const
  expect(pageOf(readingAt(SET, []), at("shed.olai")).shows).toEqual({ kind: "nothing", sought: "outline-olai", requested: "shed.olai" })
  expect(pageOf(readingAt(SET, []), HOME).shows).toEqual(nothing)
})

test("a document route opens that document, by path", () => {
  const shows = readAt(at("notes/finishes.md"))
  expect(shows.kind === "document" ? shows.file : undefined).toBe("notes/finishes.md")
})

test("a document the directory does not have is a nothing that names it", () => {
  expect(readAt(at("gone.md"))).toEqual({
    kind: "nothing",
    sought: "markdown",
    requested: "gone.md",
  })
})

test("an outline whose file did not parse is the broken page, not an empty one", () => {
  const unreadable: BrokenFile = {
    file: "house.olai",
    errors: [{ code: "not-json", file: "house.olai", line: 2, message: "not JSON" }],
  }
  expect(readAt(at("house.olai"), FILES, [unreadable])).toEqual({
    kind: "broken",
    file: unreadable,
  })
})

test("a day collects the dated nodes of every outline", () => {
  const shows = readAt({ kind: "day", date: "2026-08-10" })
  expect(shows.kind === "day" ? shows.groups.map((group) => group.file) : [])
    .toEqual(["garden.olai", "house.olai"])
})

test("a day with nothing dated it is an empty day, not a nothing", () => {
  const shows = readAt({ kind: "day", date: "2026-08-11" })
  expect(shows.kind === "day" ? shows.date : undefined).toBe("2026-08-11")
  expect(shows.kind === "day" ? shows.groups : undefined).toEqual([])
  expect(shows.kind === "day" ? shows.notes : undefined).toEqual([])
})

test("a day carries the documents named for it, beside its dated nodes", () => {
  const shows = readAt({ kind: "day", date: "2026-08-10" })
  expect(shows.kind === "day" ? shows.notes : undefined).toEqual(["Daily/2026-08-10.md"])
  expect(shows.kind === "day" ? shows.groups.length : undefined).toBe(2)
})

test("the agenda is answered for the day it was asked for, and says which", () => {
  const shows = readAt({ kind: "agenda", today: TODAY })
  expect(shows.kind === "agenda" ? shows.date : undefined).toBe(TODAY)
  expect(shows.kind === "agenda" ? shows.agenda : undefined)
    .toEqual(agendaOf(SET, TODAY))
})

const ARCHIVED = derive(TEST_CLAIMS, [
  ...RECORDS,
  ...nodesOfFiles({
    "_olai/Trash.olai": [
      `{"id":"old","ord":"a0","title":"the old kitchen"}`,
      `{"id":"tiles","parent":"old","ord":"a0","title":"choose the tiles"}`,
    ].join("\n"),
  }),
] as ReadonlyArray<Located>)

const WITH_TRASH = ["_olai/Trash.olai", ...FILES]
const WITH_LEFTOVER = ["Archive.olai", ...FILES, "garden/Archive.olai"]

test("the trash is the one `_olai/Trash.olai`, and an empty one is a page", () => {
  expect(readAt({ kind: "trash" }, WITH_TRASH)).toEqual({
    kind: "trash",
    files: ["_olai/Trash.olai"],
    groups: [],
    records: 0,
  })
  expect(readAt({ kind: "trash" }))
    .toEqual({ kind: "trash", files: [], groups: [], records: 0 })
})

test("the trash file's own address opens the trash — it is not a place you edit", () => {
  expect(readAt(at("_olai/Trash.olai"), WITH_TRASH))
    .toEqual({ kind: "trash", files: ["_olai/Trash.olai"], groups: [], records: 0 })
})

test("a leftover Archive.olai opens as an outline, not the trash", () => {
  const shows = readAt(at("Archive.olai"), WITH_LEFTOVER)
  expect(shows.kind === "outline" ? shows.file : undefined).toBe("Archive.olai")
  expect(readAt({ kind: "trash" }, WITH_LEFTOVER))
    .toEqual({ kind: "trash", files: [], groups: [], records: 0 })
})

test("a bare `/` never opens an archive, even one that sorts first", () => {
  for (const files of [WITH_TRASH, WITH_LEFTOVER]) {
    const shows = readAt(HOME, files)
    expect(shows.kind === "outline" ? shows.file : undefined).toBe("garden.olai")
  }
})

test("the trash draws each archive that has something in it, and counts the SET", () => {
  const shows = readAt({ kind: "trash" }, WITH_TRASH, READABLE, ARCHIVED)
  expect(shows.kind === "trash" ? shows.groups.map((group) => group.file) : [])
    .toEqual(["_olai/Trash.olai"])
  expect(
    shows.kind === "trash"
      ? shows.groups.flatMap((group) => group.rows.map((row) => row.at.node.id))
      : [],
  ).toEqual(["old"])
  expect(shows.kind === "trash" ? shows.records : undefined).toBe(2)
})

test("every id this page points at is resolved, once each", () => {
  const reading = pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))
  expect(reading.names).toEqual([
    { id: "herbs", title: "the herb bed", file: "garden.olai" },
  ])
})

test("an id nothing declares is absent — the honest dangling link", () => {
  const set = derive(TEST_CLAIMS, nodesOfFiles({
    "house.olai": `{"id":"a","ord":"a0","title":"a","see":["gone"]}`,
  }))
  expect(pageOf(readingAt(set, facesOf(["house.olai"])), at("house.olai")).names)
    .toEqual([])
})

test("the address the page IS gets a name too — the palette's pin row asks it", () => {
  const reading = pageOf(readingAt(SET, facesOf(FILES)), node("herbs"))
  expect(reading.names.some((one) => one.id === "herbs")).toBe(true)
})

const PROPPED = derive(TEST_CLAIMS, nodesOfFiles({
  "lanes.olai": [
    `{"id":"lane","ord":"a0","title":"a lane","custom":{"reviewer":"pi","agent":"nobody","merge":"the human approves personally"}}`,
    `{"id":"two","ord":"a1","title":"another","custom":{"reviewer":["pi","stranger"]}}`,
  ].join("\n"),
  "agents.olai": `{"id":"pi","ord":"a0","title":"pi"}`,
}))

test("a custom value that IS a node id is resolved — the door's question, asked where the set is", () => {
  const reading = pageOf(readingAt(PROPPED, facesOf(["lanes.olai", "agents.olai"])), at("lanes.olai"))
  expect(reading.names).toEqual([{ id: "pi", title: "pi", file: "agents.olai" }])
})

test("a custom value naming nothing is absent, and prose never reaches the index", () => {
  const reading = pageOf(readingAt(PROPPED, facesOf(["lanes.olai", "agents.olai"])), at("lanes.olai"))
  expect(reading.names.map((one) => one.id)).not.toContain("nobody")
  expect(reading.names.map((one) => one.id))
    .not.toContain("the human approves personally")
})

test("each member of a LIST value is asked about on its own", () => {
  const reading = pageOf(readingAt(PROPPED, facesOf(["lanes.olai", "agents.olai"])), at("lanes.olai"))
  expect(reading.names.map((one) => one.id)).toEqual(["pi"])
})

test("an outline's rows are `rowsOf`, exactly", () => {
  const shows = readAt(at("house.olai"))
  expect(shows.kind === "outline" ? shows.rows : undefined)
    .toEqual(rowsOf(SET, "house.olai"))
})

test("a node page is `zoom` plus the one references reading, exactly", () => {
  const shows = readAt(node("herbs"))
  expect(shows.kind === "node" ? shows.zoomed : undefined).toEqual(zoom(SET, "herbs"))
  const reading = readingAt(SET, facesOf(FILES))
  expect(shows.kind === "node" ? shows.backlinks : undefined)
    .toEqual(referencesOf(reading, addressOf(TEST_CLAIMS, "", "herbs")!))
})
test("a zoomed MIRROR resolves to the node it stands for, as `zoom` does", () => {
  expect(readAt(node("herbs-here"))).toEqual({
    kind: "node",
    zoomed: zoom(SET, "herbs-here"),
    backlinks: referencesOf(readingAt(SET, facesOf(FILES)), addressOf(TEST_CLAIMS, "", "herbs")!),
  })
})

test("a day is `datedOn` plus `dailyNotesOn`, exactly", () => {
  const shows = readAt({ kind: "day", date: TODAY })
  expect(shows.kind === "day" ? shows.groups : undefined).toEqual(datedOn(SET, TODAY))
  expect(shows.kind === "day" ? shows.notes : undefined)
    .toEqual(dailyNotesOn(TEST_CLAIMS, [...FILES, ...DOCUMENTS], TODAY))
})

test("the trash is `rowsOf` per archive plus `nodesOf`, exactly", () => {
  const shows = readAt({ kind: "trash" }, WITH_TRASH, READABLE, ARCHIVED)
  expect(shows.kind === "trash" ? shows.groups : undefined)
    .toEqual([{ file: "_olai/Trash.olai", rows: rowsOf(ARCHIVED, "_olai/Trash.olai") }])
  expect(shows.kind === "trash" ? shows.records : undefined)
    .toBe(nodesOf(ARCHIVED, "_olai/Trash.olai").length)
})

test("a document page is the one references reading, whole-document", () => {
  const faces: ReadonlyArray<Face> = [
    { path: "notes/finishes.md", title: "finishes", links: [], tags: [], props: {} },
    {
      path: "house.olai",
      title: "house.olai",
      links: [addressOf(TEST_CLAIMS, "notes/finishes.md", null)!],
      tags: [],
      props: {},
    },
  ] as unknown as ReadonlyArray<Face>
  const reading = readingAt(SET, faces)
  const shows = pageOf(reading, at("notes/finishes.md")).shows
  expect(shows.kind === "document" ? shows.referrers : undefined)
    .toEqual(referencesOf(reading, addressOf(TEST_CLAIMS, "notes/finishes.md", null)!))
})

test("a document page carries the frontmatter its face already has", () => {
  const empty = readAt(at("notes/finishes.md"))
  expect(empty.kind === "document" ? empty.props : undefined).toEqual({})

  const faces: ReadonlyArray<Face> = [
    {
      path: "notes/finishes.md",
      title: "Finishes",
      links: [],
      tags: [],
      props: { agent: "claude-opus", owners: ["alice", "bob"] },
    },
  ] as unknown as ReadonlyArray<Face>
  const shown = pageOf(readingAt(SET, faces), at("notes/finishes.md")).shows
  expect(shown.kind === "document" ? shown.props : undefined).toEqual({
    agent: "claude-opus",
    owners: ["alice", "bob"],
  })
})

const encode = Schema.encodeUnknownSync(PageReading)
const decode = Schema.decodeUnknownSync(PageReading)

const EVERY_ROUTE: ReadonlyArray<PageRequest> = [
  HOME,
  at("house.olai"),
  at("garden.olai"),
  at("shed.olai"),
  at("notes/finishes.md"),
  at("notes/missing.md"),
  at("_olai/Trash.olai"),
  node("kitchen"),
  node("herbs-here"),
  node("nothing-declares-this"),
  { kind: "day", date: TODAY },
  { kind: "day", date: "2026-01-01" },
  { kind: "agenda", today: TODAY },
  { kind: "trash" },
]

for (const request of EVERY_ROUTE) {
  test(`the wire carries every field of ${JSON.stringify(request)}`, () => {
    const reading = pageOf(
      readingAt(ARCHIVED, facesOf([...WITH_TRASH, ...DOCUMENTS])),
      request,
    )
    const back = decode(JSON.parse(JSON.stringify(encode(reading))))
    expect(back).toEqual(reading)
    expect(samePageReading(back, reading)).toBe(true)
  })
}

test("two readings of one set are the same reading, and a moved set is not", () => {
  const before = pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))
  expect(samePageReading(before, pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))))
    .toBe(true)
  const moved = derive(TEST_CLAIMS,
    RECORDS.map((one) =>
      one.node.id === "kitchen"
        ? { ...one, node: { ...one.node, title: "kitchen, redone" } }
        : one
    ) as ReadonlyArray<Located>,
  )
  expect(samePageReading(before, pageOf(readingAt(moved, facesOf(FILES)), at("house.olai"))))
    .toBe(false)
})

test("a filed page request admits a file, a node and the trash, and refuses the journal", () => {
  const admits = Schema.is(FiledPageRequest)
  expect(admits(at("house.olai"))).toBe(true)
  expect(admits(node("kitchen"))).toBe(true)
  expect(admits(HOME)).toBe(true)
  expect(admits({ kind: "trash" })).toBe(true)
  expect(admits({ kind: "day", date: "2026-09-06" })).toBe(false)
  expect(admits({ kind: "agenda", today: "2026-09-06" })).toBe(false)
})

test("a document page request validates address shape, not live membership", () => {
  const admits = Schema.is(DocumentPageRequest)
  for (const file of ["notes.md", "house.olai", "diagram.png", "notes.rtf"]) expect(admits({ kind: "at", address: { kind: "document", path: file } })).toBe(true)
  expect(admits(HOME)).toBe(false)
  expect(admits({ kind: "trash" })).toBe(false)
})

test("a filed page reading is what those requests are answered in, and a day is not", () => {
  const admits = Schema.is(FiledPageReading)
  expect(admits(pageOf(readingAt(SET, facesOf(FILES)), at("house.olai")))).toBe(true)
  expect(admits(pageOf(readingAt(SET, facesOf(FILES)), { kind: "trash" }))).toBe(true)
  expect(admits(pageOf(readingAt(SET, facesOf(FILES)), { kind: "day", date: "2026-09-06" })))
    .toBe(false)
})

test("an empty home names the configured outline row, even when another row claims nodes", () => {
  expect(pageOf({ ...readingAt(SET, []), outlineRow: "outline-org" }, HOME).shows)
    .toEqual({ kind: "nothing", sought: "outline-org", requested: null })
})

test("row warnings travel in the page reading and clear on a membership revision", () => {
  const records = nodesOfFiles({ "house.olai": '{"id":"a","ord":"a0","title":"[missing](target.md)"}' })
  const derived = derive(TEST_CLAIMS, records)
  const missing = pageOf(readingAt(derived, facesOf(["house.olai"])), at("house.olai"))
  expect(missing.deadLinks?.["a"]?.[0]?.resolved).toBe("target.md")
  const present = pageOf(readingAt(derived, facesOf(["house.olai", "target.md"])), at("house.olai"))
  expect(present.deadLinks).toBeUndefined()
  expect(samePageReading(missing, present)).toBe(false)
})

test("warnings cover the zoomed subject and its rows, not its trail or backlinks", () => {
  const records = nodesOfFiles({ "house.olai": [
    { id: "parent", ord: "a0", title: "Parent [x](parent.md)" },
    { id: "subject", parent: "parent", ord: "a0", title: "Subject [x](subject.md)" },
    { id: "child", parent: "subject", ord: "a0", title: "Child [x](child.md)" },
    { id: "referrer", ord: "a1", title: "Referrer [x](referrer.md)", see: ["subject"] },
  ].map(record => JSON.stringify(record)).join("\n") })
  const derived = derive(TEST_CLAIMS, records)
  const reading = pageOf(readingAt(derived, facesOf(["house.olai"])), node("subject"))
  expect(Object.keys(reading.deadLinks ?? {}).sort()).toEqual(["child", "subject"])
  expect(reading.shows).not.toHaveProperty("deadLinks")
  const changed = pageOf(readingAt(derived, facesOf(["house.olai", "parent.md", "referrer.md"])), node("subject"))
  expect(samePageReading(reading, changed)).toBe(true)
})
