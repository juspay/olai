/**
 * WHAT A PAGE SHOWS — the reading, and the PARITY that lets it be trusted.
 *
 * Two things are asserted here and they are different in kind.
 *
 * **Which page an address names**, which is the model the browser used to hold
 * (`@olai/web`'s `page.ts`, deleted with `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s
 * PR 10). Every claim it made is made here, over the same shape of fixture,
 * because the rules did not move — the set did.
 *
 * **That the reading IS the pure functions the browser used to call.** For
 * every route, what the server sends must equal what a tab would have derived
 * from its own copy of the vault — and since both sides are the same
 * `packages/format` functions, the honest way to say so is to call them
 * directly and compare. That is the oracle rule this design keeps wherever one
 * answer has two producers (`shelf.ts`'s note, `filter.ts`'s), read for the
 * one PR where the second producer is being deleted.
 *
 * **And that it survives the wire.** The parity is worth nothing if the encoder
 * drops a field on the way — which is not hypothetical: a field added to a
 * search answer once type-checked clean across every package, reached an agent,
 * and was silently dropped by the wire's own encoder
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-positions.md). So every reading below is encoded, put through
 * JSON, decoded, and compared with what went in.
 */

import { expect, test } from "bun:test"
import { Schema } from "effect"

import { addressOf } from "./address.ts"
import { agendaOf } from "./agenda.ts"
import { backlinksOf, referrersTo } from "./backlinks.ts"
import { dailyNotesOn, datedOn } from "./dates.ts"
import { derive, type Derived, nodesOf, rowsOf } from "./derive.ts"
import type { Document, Face } from "./document.ts"
import { nodesOfFiles } from "./fixtures.testlib.ts"
import type { Located } from "./node.ts"
import { PageReading, type PageRequest, pageOf, samePageReading } from "./page.ts"
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
const SET = derive(RECORDS)

/** What day it is, for the two arms that have to be told. Fixed, because a
 *  reading that read a clock would be a reading whose tests expire. */
const TODAY = "2026-08-10"

/** The served directory, as its faces — the shape a caller hands this reading
 *  (the set's own documents, which ARE faces plus their content). A face's
 *  links and tags are no business of these claims, so the fixtures say only
 *  what a path is; the referrers case below writes its own with links in. */
const facesOf = (paths: ReadonlyArray<string>): ReadonlyArray<Face> =>
  paths.map((path) => ({ path, title: path, links: [], tags: [], props: {} }) as unknown as Face)

const FILES = ["garden.olai", "house.olai"]
/** Two of these are about the day arm: one NAMED for a date, which IS that
 *  day's note, and one merely naming a date, which is a document about a day
 *  and nobody's note. */
const DOCUMENTS = [
  "notes/finishes.md",
  "Daily/2026-08-10.md",
  "notes/2026-08-10-recap.md",
]

const READABLE: ReadonlyArray<BrokenFile> = []

/**
 * The three-field {@link Reading} these cases are read through — a derivation,
 * the faces standing in for the served files, and the links index those faces
 * amount to (`./pointing.ts`).
 *
 * The SET is a stand-in and is cast as one: what a page reads off it is the two
 * arrays, and the fixtures above write faces rather than whole documents
 * because a face is all these claims are about. The index is built from the
 * same faces by the same fold the validator runs, so a case that gives a face
 * links gets the referrers those links amount to and nothing has to be kept in
 * step by hand.
 */
const readingAt = (
  derived: Derived,
  faces: ReadonlyArray<Face>,
  broken: ReadonlyArray<BrokenFile> = READABLE,
): Reading => ({
  set: { documents: faces, broken } as unknown as OutlineSet,
  derived,
  pointing: pointingOf(faces as unknown as ReadonlyArray<Document>),
})

const readAt = (
  request: PageRequest,
  files = FILES,
  broken = READABLE,
  set = SET,
) => pageOf(readingAt(set, facesOf([...files, ...DOCUMENTS]), broken), request).shows

const at = (path: string, element: string | null = null): PageRequest => ({
  kind: "at",
  address: addressOf(path, element)!,
})
const HOME: PageRequest = { kind: "at", address: null }
const node = (id: string): PageRequest => ({ kind: "at", address: addressOf("", id)! })

/** The ids a page's rows start from — what its screen would show. */
const roots = (shows: ReturnType<typeof readAt>): ReadonlyArray<string> =>
  shows.kind === "outline"
    ? shows.rows.map((row) => row.at.node.id)
    : shows.kind === "node" && shows.zoomed.kind === "node"
    ? shows.zoomed.children.map((row) => row.at.node.id)
    : []

// ── which page an address names ────────────────────────────────────────

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

// The two nothings are decided HERE rather than by a view counting files, so
// the screen that says them has one thing to say and no reasoning to do.
test("an outline the directory does not have is a nothing that names it", () => {
  expect(readAt(at("shed.olai"))).toEqual({
    kind: "nothing",
    sought: "outline",
    requested: "shed.olai",
  })
})

test("a directory with no outlines at all is the other nothing", () => {
  const nothing = { kind: "nothing", sought: "outline", requested: null } as const
  expect(pageOf(readingAt(SET, []), at("shed.olai")).shows).toEqual(nothing)
  expect(pageOf(readingAt(SET, []), HOME).shows).toEqual(nothing)
})

test("a document route opens that document, by path", () => {
  const shows = readAt(at("notes/finishes.md"))
  expect(shows.kind === "document" ? shows.file : undefined).toBe("notes/finishes.md")
})

test("a document the directory does not have is a nothing that names it", () => {
  expect(readAt(at("gone.md"))).toEqual({
    kind: "nothing",
    sought: "document",
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

// ── the day ────────────────────────────────────────────────────────────

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

// The day's other half: a document named for the date is that day's note, and
// it JOINS the query's answer rather than replacing it. A document merely
// NAMING the date is not one.
test("a day carries the documents named for it, beside its dated nodes", () => {
  const shows = readAt({ kind: "day", date: "2026-08-10" })
  expect(shows.kind === "day" ? shows.notes : undefined).toEqual(["Daily/2026-08-10.md"])
  expect(shows.kind === "day" ? shows.groups.length : undefined).toBe(2)
})

// ── the agenda ─────────────────────────────────────────────────────────

test("the agenda is answered for the day it was asked for, and says which", () => {
  const shows = readAt({ kind: "agenda", today: TODAY })
  expect(shows.kind === "agenda" ? shows.date : undefined).toBe(TODAY)
  expect(shows.kind === "agenda" ? shows.agenda : undefined)
    .toEqual(agendaOf(SET, TODAY))
})

// ── the trash ──────────────────────────────────────────────────────────

const ARCHIVED = derive([
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
    // Nothing has been put away in the plain fixture, so the archive is a file
    // with no rows: not a heading over nothing, which is also what makes "the
    // trash is empty" this list being empty.
    groups: [],
    records: 0,
  })
  // Nothing put away yet at all — `trash_node` creates the file on first use,
  // so an absent trash is an empty page, never a missing one.
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
  // TWO records go, and only one row is drawn: `tiles` hangs under `old`.
  expect(shows.kind === "trash" ? shows.records : undefined).toBe(2)
})

// ── the names table ────────────────────────────────────────────────────

test("every id this page points at is resolved, once each", () => {
  const reading = pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))
  // `install` sees `herbs`; `linky`'s TITLE addresses the same node. One entry.
  expect(reading.names).toEqual([
    { id: "herbs", title: "the herb bed", file: "garden.olai" },
  ])
})

test("an id nothing declares is absent — the honest dangling link", () => {
  const set = derive(nodesOfFiles({
    "house.olai": `{"id":"a","ord":"a0","title":"a","see":["gone"]}`,
  }))
  expect(pageOf(readingAt(set, facesOf(["house.olai"])), at("house.olai")).names)
    .toEqual([])
})

test("the address the page IS gets a name too — the palette's pin row asks it", () => {
  const reading = pageOf(readingAt(SET, facesOf(FILES)), node("herbs"))
  expect(reading.names.some((one) => one.id === "herbs")).toBe(true)
})

/** The set the custom-value cases below are read against: one node carrying a
 *  property that IS an id, one that only looks like a word, one holding a
 *  sentence, and one holding a list of both kinds. */
const PROPPED = derive(nodesOfFiles({
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
  // `nobody` is id-shaped and declares nothing; `merge` holds a sentence, which
  // is not id-shaped at all. Neither is a name, and the drawer draws both as
  // the plain text they are.
  expect(reading.names.map((one) => one.id)).not.toContain("nobody")
  expect(reading.names.map((one) => one.id))
    .not.toContain("the human approves personally")
})

test("each member of a LIST value is asked about on its own", () => {
  const reading = pageOf(readingAt(PROPPED, facesOf(["lanes.olai", "agents.olai"])), at("lanes.olai"))
  // `two` carries `["pi","stranger"]`: the first is a node, the second is not,
  // and one entry answers for both rows that name it.
  expect(reading.names.map((one) => one.id)).toEqual(["pi"])
})

// ── parity: the reading IS the pure functions the browser used to call ──

test("an outline's rows are `rowsOf`, exactly", () => {
  const shows = readAt(at("house.olai"))
  expect(shows.kind === "outline" ? shows.rows : undefined)
    .toEqual(rowsOf(SET, "house.olai"))
})

test("a node page is `zoom` plus `backlinksOf`, exactly", () => {
  const shows = readAt(node("herbs"))
  expect(shows.kind === "node" ? shows.zoomed : undefined).toEqual(zoom(SET, "herbs"))
  expect(shows.kind === "node" ? shows.backlinks : undefined)
    .toEqual(backlinksOf(SET, "herbs"))
})

test("a zoomed MIRROR resolves to the node it stands for, as `zoom` does", () => {
  expect(readAt(node("herbs-here"))).toEqual({
    kind: "node",
    zoomed: zoom(SET, "herbs-here"),
    backlinks: backlinksOf(SET, "herbs"),
  })
})

test("a day is `datedOn` plus `dailyNotesOn`, exactly", () => {
  const shows = readAt({ kind: "day", date: TODAY })
  expect(shows.kind === "day" ? shows.groups : undefined).toEqual(datedOn(SET, TODAY))
  expect(shows.kind === "day" ? shows.notes : undefined)
    .toEqual(dailyNotesOn([...FILES, ...DOCUMENTS], TODAY))
})

test("the trash is `rowsOf` per archive plus `nodesOf`, exactly", () => {
  const shows = readAt({ kind: "trash" }, WITH_TRASH, READABLE, ARCHIVED)
  expect(shows.kind === "trash" ? shows.groups : undefined)
    .toEqual([{ file: "_olai/Trash.olai", rows: rowsOf(ARCHIVED, "_olai/Trash.olai") }])
  expect(shows.kind === "trash" ? shows.records : undefined)
    .toBe(nodesOf(ARCHIVED, "_olai/Trash.olai").length)
})

test("a document page is `referrersTo`, exactly", () => {
  const faces: ReadonlyArray<Face> = [
    { path: "notes/finishes.md", title: "finishes", links: [], tags: [], props: {} },
    {
      path: "house.olai",
      title: "house.olai",
      links: [addressOf("notes/finishes.md", null)!],
      tags: [],
      props: {},
    },
  ] as unknown as ReadonlyArray<Face>
  const reading = readingAt(SET, faces)
  const shows = pageOf(reading, at("notes/finishes.md")).shows
  expect(shows.kind === "document" ? shows.referrers : undefined)
    .toEqual(referrersTo(addressOf("notes/finishes.md", null)!, reading.pointing, SET))
})

test("a document page carries the frontmatter its face already has", () => {
  // The page ABOUT a document is where its record is read, the same way a
  // node's own page draws the node's custom map. Empty is the honest none —
  // a file that wrote no block, or a `.html` that never could — and not an
  // omitted field: the face's `props` is total.
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

// ── ...and it survives the wire whole ──────────────────────────────────

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
    // …and the equivalence the server sends frames by agrees with that, which
    // is the other half: a reading that came back equal and compared unequal
    // would be a frame per revision to every open tab.
    expect(samePageReading(back, reading)).toBe(true)
  })
}

test("two readings of one set are the same reading, and a moved set is not", () => {
  const before = pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))
  expect(samePageReading(before, pageOf(readingAt(SET, facesOf(FILES)), at("house.olai"))))
    .toBe(true)
  const moved = derive(
    RECORDS.map((one) =>
      one.node.id === "kitchen"
        ? { ...one, node: { ...one.node, title: "kitchen, redone" } }
        : one
    ) as ReadonlyArray<Located>,
  )
  expect(samePageReading(before, pageOf(readingAt(moved, facesOf(FILES)), at("house.olai"))))
    .toBe(false)
})
