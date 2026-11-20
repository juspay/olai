import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  assemble,
  type Document,
  type OutlineSet,
  type Reading,
  type Verdict,
  verdictOf,
} from "@olai/format"
import { outlineOf, readingOf, recordsOf, setOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { publishedOf } from "./published.testlib.ts"

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}\n'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}\n'

const revision = (
  value: OutlineSet,
  moved: { changed?: ReadonlyArray<string>; removed?: ReadonlyArray<string> } = {},
  rev = 1,
): Snapshot<Reading> => ({
  rev,
  value: readingOf(value),
  changed: moved.changed ?? value.documents.map((document) => document.path),
  removed: moved.removed ?? [],
})

const NOTHING_HELD = null

test("every file the set lists gets an entry, at the set's revision", () => {
  const { outlines } = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE, "empty.olai": "" }, [["notes.md", "hello"]]),
      {},
      7,
    ),
    NOTHING_HELD,
  )

  expect([...outlines.entries.keys()]).toEqual(["empty.olai", "house.olai"])
  expect(outlines.entries.get("house.olai")).toMatchObject({
    rev: 7,
    nodes: recordsOf(setOf({ "house.olai": HOUSE })),
    broken: null,
  })
  expect(outlines.entries.get("house.olai")?.face.title).toBe("house")
  expect(outlines.entries.get("empty.olai")).toMatchObject({
    rev: 7,
    nodes: [],
    broken: null,
  })
  expect(outlines.entries.has("notes.md")).toBe(false)
})

test("a file that did not parse keeps its key and carries its errors", () => {
  const { outlines } = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [], { "shed.olai": "{" })),
    NOTHING_HELD,
  )

  const shed = outlines.entries.get("shed.olai")
  expect(shed?.nodes).toEqual([])
  expect(shed?.broken?.file).toBe("shed.olai")
  expect(shed?.broken?.errors.length).toBeGreaterThan(0)
  expect(outlines.entries.get("house.olai")?.broken).toBeNull()
})

test("only the files the probe re-decoded are upserted", () => {
  const before = publishedOf(
    revision(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(
      setOf({
        "house.olai": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
      }, [["notes.md", "changed too"]]),
      { changed: ["house.olai", "notes.md"], removed: ["garden.olai"] },
      2,
    ),
    before,
  )

  expect(published.outlines.upserts.map(([path]) => path)).toEqual(["house.olai"])
  expect(published.outlines.upserts[0]?.[1].rev).toBe(2)
  expect(published.outlines.removes).toEqual(["garden.olai"])
  expect(published.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
  expect(published.outlines.entries.has("garden.olai")).toBe(false)
  expect([...published.outlines.entries.keys()]).toEqual(["house.olai"])
  expect([...published.heads.entries.keys()]).toEqual(["house.olai", "notes.md"])
})

test("a key that leaves as another kind arrives is dropped from its own map", () => {
  const before = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }),
      { changed: ["garden.olai"], removed: ["notes.md"] },
      2,
    ),
    before,
  )

  expect(published.documents.removes).toEqual(["notes.md"])
  expect(published.documents.entries.has("notes.md")).toBe(false)
  expect([...published.documents.entries.keys()]).toEqual([])
  expect([...published.outlines.entries.keys()]).toEqual(["garden.olai", "house.olai"])
  expect(published.outlines.entries.get("house.olai")?.rev).toBe(1)
})

test("a revision moves for the files that moved and for no others", () => {
  const first = publishedOf(
    revision(setOf({ "house.olai": HOUSE, "garden.olai": GARDEN })),
    NOTHING_HELD,
  )
  const held = first.outlines.entries.get("garden.olai")
  const next = publishedOf(
    revision(
      setOf({
        "house.olai": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.olai": GARDEN,
      }, []),
      { changed: ["house.olai"], removed: [] },
      2,
    ),
    first,
  )

  expect(next.outlines.entries.get("house.olai")?.rev).toBe(2)
  expect(next.outlines.entries.get("garden.olai")?.rev).toBe(1)
  expect(next.outlines.entries.get("garden.olai")).toBe(held as never)
})

test("a removed path that was never an entry is not a remove", () => {
  const held = publishedOf(revision(setOf({ "house.olai": HOUSE })), NOTHING_HELD)
  const published = publishedOf(
    revision(setOf({ "house.olai": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held,
  )

  expect(published.outlines.removes).toEqual([])
  expect(published.documents.removes).toEqual([])
})

test("a document's text is in its own entry, keyed by its path", () => {
  const { outlines, documents } = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]]), {}, 3),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md"])
  expect(documents.entries.get("notes.md")).toEqual({
    rev: 3,
    text: "# hello",
    refused: false,
  })
  expect(JSON.stringify([...outlines.entries.values()])).not.toContain("# hello")
})

test("a document that left the directory is a remove of its key", () => {
  const held = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(setOf({ "house.olai": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held,
  )

  expect(published.documents.removes).toEqual(["notes.md"])
  expect(published.documents.entries.has("notes.md")).toBe(false)
})

test("a file that did not move keeps the entry it was published with", () => {
  const first = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }, [["notes.md", "# hello"]]),
    ),
    NOTHING_HELD,
  )
  const garden = first.outlines.entries.get("garden.olai")
  const notes = first.documents.entries.get("notes.md")
  const second = publishedOf(
    revision(
      setOf({
        "house.olai": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.olai": GARDEN,
      }, [["notes.md", "# hello"]]),
      { changed: ["house.olai"] },
      2,
    ),
    first,
  )

  expect(second.outlines.entries.get("garden.olai")).toBe(garden!)
  expect(second.outlines.entries.get("garden.olai")?.rev).toBe(1)
  expect(second.outlines.entries.get("house.olai")?.rev).toBe(2)
  expect(second.documents.entries.get("notes.md")).toBe(notes!)
  expect(second.documents.upserts).toEqual([])
})

test("a file that arrives takes its place in the listing, not the end of it", () => {
  const before = publishedOf(
    revision(setOf({ "house.olai": HOUSE, "wing.olai": GARDEN }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  expect([...before.heads.entries.keys()]).toEqual(["house.olai", "notes.md", "wing.olai"])

  const born = publishedOf(
    revision(
      setOf({ "aaa.olai": GARDEN, "house.olai": HOUSE, "mid.olai": GARDEN, "wing.olai": GARDEN }, [[
        "notes.md",
        "# hello",
      ]]),
      { changed: ["aaa.olai", "mid.olai"] },
      2,
    ),
    before,
  )

  expect([...born.heads.entries.keys()]).toEqual([
    "aaa.olai",
    "house.olai",
    "mid.olai",
    "notes.md",
    "wing.olai",
  ])
  expect([...born.outlines.entries.keys()]).toEqual([
    "aaa.olai",
    "house.olai",
    "mid.olai",
    "wing.olai",
  ])
  expect(born.heads.entries.get("house.olai")?.rev).toBe(1)
  expect(born.outlines.entries.get("wing.olai")?.rev).toBe(1)
})

test("a parse-broken document is not refused, and an unreadable one is", () => {
  const parsed = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]], {
        "torn.md": "whatever the bytes were",
      }),
      {},
      5,
    ),
    NOTHING_HELD,
  )
  expect(parsed.documents.entries.get("torn.md")).toEqual({
    rev: 5,
    text: "",
    refused: false,
  })
  expect(parsed.heads.entries.get("torn.md")?.broken).not.toBeNull()
  expect(parsed.documents.entries.get("notes.md")?.refused).toBe(false)

  const unread = publishedOf(
    revision(
      assemble(TEST_CLAIMS,
        new Map<string, Result.Result<Document, Verdict>>([
          ["house.olai", Result.succeed(outlineOf(HOUSE, "house.olai"))],
          [
            "locked.md",
            Result.fail(verdictOf([
              {
                file: "locked.md",
                line: 0,
                code: "unreadable-file",
                message:
                  "EACCES — this file is in the directory and will not open.",
              },
            ])),
          ],
        ]),
      ),
      {},
      6,
    ),
    NOTHING_HELD,
  )
  expect(unread.documents.entries.get("locked.md")).toEqual({
    rev: 6,
    text: "",
    refused: true,
  })
  expect(unread.heads.entries.get("locked.md")?.broken).not.toBeNull()
})

test("unkept and byte files have heads but never enter markdown's collection", () => {
  const first = publishedOf(revision(setOf({ "house.olai": HOUSE }, [
    ["notes.md", "# hello"], "report.html", "data/sales.csv", "art/handle.png", "reports/q3.pdf",
  ])), NOTHING_HELD)
  expect([...first.documents.entries.keys()]).toEqual(["notes.md"])
  expect([...first.heads.entries.keys()].sort()).toEqual([
    "art/handle.png", "data/sales.csv", "house.olai", "notes.md", "report.html", "reports/q3.pdf",
  ])
  const second = publishedOf(revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]]),
    { changed: [], removed: ["report.html", "data/sales.csv", "art/handle.png", "reports/q3.pdf"] }, 2), first)
  expect(second.documents.removes).toEqual([])
  expect([...second.heads.removes].sort()).toEqual(["art/handle.png", "data/sales.csv", "report.html", "reports/q3.pdf"])
})

test("every served file has a head, and it is that file's revision alone", () => {
  const { documents, heads } = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      {},
      4,
    ),
    NOTHING_HELD,
  )

  for (const path of documents.entries.keys()) expect(heads.entries.has(path)).toBe(true)
  expect([...heads.entries.keys()]).toEqual(["house.olai", "notes.md", "report.html"])
  expect(heads.entries.get("notes.md")).toMatchObject({ rev: 4 })
  expect(heads.entries.get("report.html")).toMatchObject({ rev: 4 })
  expect(heads.entries.get("house.olai")).toMatchObject({ rev: 4 })
  expect(heads.entries.get("notes.md")?.face.title).toBe("hello")
  expect(heads.entries.get("house.olai")?.broken).toBe(null)
  expect(heads.entries.get("house.olai")).not.toHaveProperty("nodes")
  expect(heads.entries.get("notes.md")).not.toHaveProperty("text")
})

test("a `.html` that changed is upserted here even though its body is not", () => {
  const first = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"])),
    NOTHING_HELD,
  )
  expect(first.heads.upserts.map(([path]) => path)).toEqual([
    "house.olai",
    "notes.md",
    "report.html",
  ])

  const second = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      { changed: ["report.html"] },
      2,
    ),
    first,
  )
  expect(second.documents.upserts).toEqual([])
  expect(second.heads.upserts.map(([path, head]) => [path, head.rev]))
    .toEqual([["report.html", 2]])
  expect(second.heads.entries.get("notes.md")?.rev).toBe(1)

  const gone = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]]),
      { changed: [], removed: ["report.html"] },
      3,
    ),
    second,
  )
  expect(gone.heads.removes).toEqual(["report.html"])
  expect(gone.heads.entries.has("report.html")).toBe(false)
})
