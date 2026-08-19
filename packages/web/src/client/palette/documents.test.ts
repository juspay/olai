/**
 * The document rows: which files a query means, what each row draws, and where
 * it goes — over a directory spelled out here rather than served.
 *
 * The MATCHING itself is `../file/matching.ts`'s and is held there
 * (`../file/matching.test.ts` asserts the buckets and their order). What is
 * asserted here is what this module decides on top of it: which of the served
 * paths are rows at all, the face and the address of one, and the empty box.
 */

import { expect, test } from "bun:test"

import { documentItems } from "./documents.ts"

/** A directory with all three served kinds in it, one of each nested, so a
 *  test can tell "matched the name" from "matched the folder". */
const DIRECTORY = [
  "Daily/2026-08.olai",
  "finishes.md",
  "garden.olai",
  "house.olai",
  "notes/cabinets.md",
  "notes/palette.md",
  "report.html",
]

const ids = (query: string): ReadonlyArray<string> =>
  documentItems(DIRECTORY, query).map((item) => item.id)

test("an outline is not a document row, however well the query fits it", () => {
  // The whole point of the parity work is that a `.md` is reachable, not that
  // the palette becomes a file browser: an outline already has the tree pages,
  // and a row here would open the wrong kind of page for it.
  expect(ids("garden")).toEqual([])
  expect(ids("olai")).toEqual([])
})

test("a document is matched by its own name", () => {
  expect(ids("palette")).toEqual(["doc-notes/palette.md"])
  expect(ids("FINISH")).toEqual(["doc-finishes.md"])
})

test("...and by the folder it sits in, which is a way in a reader can predict", () => {
  expect(ids("notes/")).toEqual(["doc-notes/cabinets.md", "doc-notes/palette.md"])
})

test("a saved page is a document row too — every file drawn as a body", () => {
  // `bodyKind`'s answer and not a hand-written list of suffixes: the registry
  // says which files are drawn as a body, and the sidebar, the router and this
  // list all ask it rather than each other.
  expect(ids("report")).toEqual(["doc-report.html"])
})

test("an empty box is the commands, and nothing else", () => {
  // A bare `@` in a message completes to the whole directory on purpose; an
  // untouched ⌘K is a list of commands, and a directory listing poured into it
  // would bury them.
  expect(ids("")).toEqual([])
  expect(ids("   ")).toEqual([])
})

test("a query nothing is called answers with nothing", () => {
  expect(ids("alice")).toEqual([])
})

test("the block is a shortlist, whatever the vault holds", () => {
  const many = Array.from({ length: 40 }, (_, at) => `notes/note-${at}.md`)
  expect(documentItems(many, "note").length).toBe(8)
})

test("a row wears the sidebar's face and opens the file's own page", () => {
  const [row] = documentItems(DIRECTORY, "palette")
  expect(row?.label).toBe("palette.md")
  // The NAME is the label and the FOLDER is the line under it — a vault of
  // daily notes is a column of identical prefixes otherwise.
  expect(row?.place).toBe("notes")
  expect(row?.of).toBe("document")
  expect(row?.action).toEqual({
    kind: "route",
    route: { kind: "document", file: "notes/palette.md" },
  })
})

test("a file at the root draws no place line rather than an empty one", () => {
  const [row] = documentItems(DIRECTORY, "finishes")
  expect(row?.label).toBe("finishes.md")
  expect(row?.place).toBeUndefined()
  expect(row?.of).toBe("document")
})

test("a saved page carries its own kind, so its glyph is its own", () => {
  const [row] = documentItems(DIRECTORY, "report")
  expect(row?.of).toBe("hypertext")
  expect(row?.action).toEqual({
    kind: "route",
    route: { kind: "document", file: "report.html" },
  })
})

test("a document row is never filtered a second time by the shell's matcher", () => {
  // Its haystack is empty, exactly as a node hit's is: this module has already
  // decided the row matches, and `filterItems` running over it again would
  // drop every one of them (`./items.ts`).
  const [row] = documentItems(DIRECTORY, "palette")
  expect(row?.search).toBe("")
})

