/**
 * The projection from one published revision to what the wire holds.
 *
 * Three properties are worth a test. Every file the set lists keeps a key of
 * its collection, whatever it holds and whether or not it parsed. The per-tick
 * change is the STORE's diff mapped onto the collection's verbs, never a
 * comparison of two sets — a key that was never held is not a remove. And a
 * document's TEXT is in that document's own entry and nowhere else: not on the
 * manifest, not in an outline's slice, so nothing carries the corpus.
 */

import type { OutlineSet, Reading } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"

import { publishedOf } from "./published.ts"

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}\n'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}\n'

/** A revision, moved however the caller says — by default everything, which is
 *  what a first probe reports. `changed` names documents too: the store is
 *  talking about a directory, not about outlines. */
const revision = (
  value: OutlineSet,
  moved: { changed?: ReadonlyArray<string>; removed?: ReadonlyArray<string> } = {},
  rev = 1,
): Snapshot<Reading> => ({
  rev,
  // The pair the store publishes: a snapshot carries the set AND the view the
  // validator judged it against, and this projection reads both halves.
  value: readingOf(value),
  changed: moved.changed ?? [...value.files, ...value.documents.map((d) => d.file)],
  removed: moved.removed ?? [],
})

/** The first revision: the wire is holding nothing yet. */
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
  expect(outlines.entries.get("house.olai")).toEqual({
    rev: 7,
    nodes: setOf({ "house.olai": HOUSE }).nodes,
    broken: null,
  })
  // A file that holds nothing is still an outline somebody can open.
  expect(outlines.entries.get("empty.olai")).toEqual({ rev: 7, nodes: [], broken: null })
  // A document is not an outline: it is a key of its own collection.
  expect(outlines.entries.has("notes.md")).toBe(false)
})

// The per-entity degrade, as data: the key stays and the errors are IN it, so
// the sidebar still lists the file and its own pane is what shows the trouble.
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
  // The document that moved in the same tick is the OTHER collection's upsert,
  // and each one names only its own keys.
  expect(published.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
})

// A collection may not be told to drop a key it never had — the store talks
// about a directory, and a `.md` leaving it is not an outline leaving this.
test("a removed path that was never an entry is not a remove", () => {
  const held = publishedOf(revision(setOf({ "house.olai": HOUSE })), NOTHING_HELD)
  const published = publishedOf(
    revision(setOf({ "house.olai": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held,
  )

  expect(published.outlines.removes).toEqual([])
  expect(published.documents.removes).toEqual([])
})

// The whole of snapshot-scale, as one assertion: a document's body is in that
// document's ENTRY, keyed by its path, and it is the only place a projection
// puts one. The other half — that the value every subscription reads on its
// first frame carries no documents — is the `manifest` cell, which this
// projection no longer has anything to say about at all.
test("a document's text is in its own entry, keyed by its path", () => {
  const { outlines, documents } = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]]), {}, 3),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md"])
  expect(documents.entries.get("notes.md")).toEqual({ rev: 3, text: "# hello" })
  // Not smuggled into the outline's slice either: an outline entry is nodes.
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

// What a collection HOLDS is what it SAID: an untouched file keeps the entry
// it was published with, so the snapshot a fresh subscriber reads and the
// deltas an open one received cannot name different revisions for it. True of
// both collections, because it is one rule read twice.
test("a file that did not move keeps the entry it was published with", () => {
  const first = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE, "garden.olai": GARDEN }, [["notes.md", "# hello"]]),
    ),
    NOTHING_HELD,
  )
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

  expect(second.outlines.entries.get("garden.olai")).toBe(
    first.outlines.entries.get("garden.olai")!,
  )
  expect(second.outlines.entries.get("garden.olai")?.rev).toBe(1)
  expect(second.outlines.entries.get("house.olai")?.rev).toBe(2)
  // An untouched document is not re-published either — which is what keeps an
  // open reader's body from arriving again every time a neighbour is saved.
  expect(second.documents.entries.get("notes.md")).toBe(
    first.documents.entries.get("notes.md")!,
  )
  expect(second.documents.upserts).toEqual([])
})

// The other kind of bodied file, and the whole memory claim as a projection:
// what the set holds for a `.html` is a path and a `null`, so what the wire
// holds is a key and a `null`. The bytes are not here, they are not in the
// entry the next revision builds, and they are not in the map a fresh
// subscriber is snapshotted from — they are read when a reader opens the key
// (`./bodies.ts`).
test("a `.html` is a key of the collection with no body in it", () => {
  const { documents } = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      {},
      4,
    ),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md", "report.html"])
  expect(documents.entries.get("report.html")).toEqual({ rev: 4, text: null })
  // The `.md` beside it is untouched by any of this: its text is the set's and
  // travels the same way it always did.
  expect(documents.entries.get("notes.md")).toEqual({ rev: 4, text: "# hello" })
})

// ── who publishes a body ───────────────────────────────────────────────

// The split, and the two things it has to get right at once. A body the set
// does not keep is NOT written to a key somebody may be showing — that would
// blank the page and re-fill it a moment later, where the body reader replaces
// it in one frame — and a key this revision INTRODUCES is written anyway,
// because an upsert is also how the collection learns its membership changed.
// A `.html` dropped into the directory that never reached the sidebar is what
// the second half of this is written against.
test("a bodyless entry is upserted only when its key is new", () => {
  const first = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"])),
    NOTHING_HELD,
  )
  // Born: the key is announced, `null` and all, which is how the sidebar learns
  // there is a file — and the body is owed to whoever opens it.
  expect(first.documents.upserts.map(([path]) => path)).toEqual([
    "notes.md",
    "report.html",
  ])
  expect(first.unread).toEqual(["report.html"])

  // The same file, changed under a reader who has it open: the body reader
  // publishes it, and the collection is told nothing in the meantime.
  const second = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      { changed: ["report.html"] },
      2,
    ),
    first,
  )
  expect(second.documents.upserts).toEqual([])
  expect(second.unread).toEqual(["report.html"])
  // The ENTRY is still there whichever half publishes it: `readAll` is what a
  // fresh subscription reads, and a key missing from it is a file the sidebar
  // stopped showing.
  expect(second.documents.entries.get("report.html")).toEqual({ rev: 2, text: null })

  // A file that LEAVES is a remove like any other — nothing about a body the
  // set does not keep changes what a departure is.
  const gone = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"]]),
      { changed: [], removed: ["report.html"] },
      3,
    ),
    second,
  )
  expect(gone.documents.removes).toEqual(["report.html"])
  expect(gone.unread).toEqual([])
})

// ── the heads ──────────────────────────────────────────────────────────

// The other slice of the same list, and the property the wire promises about
// it: the same keys as `documents`, at the same revisions, with no body on any
// of them. A reader takes its FILE LIST from here, so a head missing for a file
// the directory holds is a file the sidebar stops listing.
test("every bodied file has a head, and it is that file's revision alone", () => {
  const { documents, heads } = publishedOf(
    revision(
      setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"]),
      {},
      4,
    ),
    NOTHING_HELD,
  )

  expect([...heads.entries.keys()]).toEqual([...documents.entries.keys()])
  expect(heads.entries.get("notes.md")).toEqual({ rev: 4 })
  expect(heads.entries.get("report.html")).toEqual({ rev: 4 })
  // An outline is not a bodied file: it has an entry of its own, with its own
  // revision on it.
  expect(heads.entries.has("house.olai")).toBe(false)
})

// The half `documents` cannot do, and the reason this member exists. A `.html`
// that changed is withheld from the documents collection — the body reader
// replaces that entry in one frame, and writing a `null` over an open key would
// blank the page — so a reader watching for "this file moved" heard nothing
// there unless somebody read the file. The head has no body to withhold.
test("a `.html` that changed is upserted here even though its body is not", () => {
  const first = publishedOf(
    revision(setOf({ "house.olai": HOUSE }, [["notes.md", "# hello"], "report.html"])),
    NOTHING_HELD,
  )
  expect(first.heads.upserts.map(([path]) => path)).toEqual([
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
  expect(second.heads.upserts).toEqual([["report.html", { rev: 2 }]])
  // …and the file NOBODY touched keeps the number it was published with, so a
  // reader watching it is not woken by the directory's clock.
  expect(second.heads.entries.get("notes.md")).toEqual({ rev: 1 })

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
