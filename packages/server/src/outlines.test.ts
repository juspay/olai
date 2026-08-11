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

import type { OutlineSet } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"

import { type Held, publishedOf } from "./outlines.ts"

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}\n'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}\n'

/** A revision, moved however the caller says — by default everything, which is
 *  what a first probe reports. `changed` names documents too: the store is
 *  talking about a directory, not about outlines. */
const revision = (
  value: OutlineSet,
  moved: { changed?: ReadonlyArray<string>; removed?: ReadonlyArray<string> } = {},
  rev = 1,
): Snapshot<OutlineSet> => ({
  rev,
  value,
  changed: moved.changed ?? [...value.files, ...value.documents.map((d) => d.file)],
  removed: moved.removed ?? [],
})

const NOTHING_HELD: Held = { outlines: new Map(), documents: new Map() }

test("every file the set lists gets an entry, at the set's revision", () => {
  const { outlines } = publishedOf(
    revision(
      setOf({ "house.jsonl": HOUSE, "empty.jsonl": "" }, [["notes.md", "hello"]]),
      {},
      7,
    ),
    NOTHING_HELD,
  )

  expect([...outlines.entries.keys()]).toEqual(["house.jsonl", "empty.jsonl"])
  expect(outlines.entries.get("house.jsonl")).toEqual({
    rev: 7,
    nodes: setOf({ "house.jsonl": HOUSE }).nodes,
    broken: null,
  })
  // A file that holds nothing is still an outline somebody can open.
  expect(outlines.entries.get("empty.jsonl")).toEqual({ rev: 7, nodes: [], broken: null })
  // A document is not an outline: it is a key of its own collection.
  expect(outlines.entries.has("notes.md")).toBe(false)
})

// The per-entity degrade, as data: the key stays and the errors are IN it, so
// the sidebar still lists the file and its own pane is what shows the trouble.
test("a file that did not parse keeps its key and carries its errors", () => {
  const { outlines } = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }, [], { "shed.jsonl": "{" })),
    NOTHING_HELD,
  )

  const shed = outlines.entries.get("shed.jsonl")
  expect(shed?.nodes).toEqual([])
  expect(shed?.broken?.file).toBe("shed.jsonl")
  expect(shed?.broken?.errors.length).toBeGreaterThan(0)
  expect(outlines.entries.get("house.jsonl")?.broken).toBeNull()
})

test("only the files the probe re-decoded are upserted", () => {
  const before = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE, "garden.jsonl": GARDEN })),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(
      setOf({
        "house.jsonl": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
      }, [["notes.md", "changed too"]]),
      { changed: ["house.jsonl", "notes.md"], removed: ["garden.jsonl"] },
      2,
    ),
    { outlines: before.outlines.entries, documents: before.documents.entries },
  )

  expect(published.outlines.upserts.map(([path]) => path)).toEqual(["house.jsonl"])
  expect(published.outlines.upserts[0]?.[1].rev).toBe(2)
  expect(published.outlines.removes).toEqual(["garden.jsonl"])
  // The document that moved in the same tick is the OTHER collection's upsert,
  // and each one names only its own keys.
  expect(published.documents.upserts.map(([path]) => path)).toEqual(["notes.md"])
})

// A collection may not be told to drop a key it never had — the store talks
// about a directory, and a `.md` leaving it is not an outline leaving this.
test("a removed path that was never an entry is not a remove", () => {
  const held = publishedOf(revision(setOf({ "house.jsonl": HOUSE })), NOTHING_HELD)
  const published = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    { outlines: held.outlines.entries, documents: held.documents.entries },
  )

  expect(published.outlines.removes).toEqual([])
  expect(published.documents.removes).toEqual([])
})

// The whole of snapshot-scale, as one assertion: a document's body is in that
// document's entry, and the manifest — the value EVERY subscription reads on
// its first frame — knows nothing about it. A `documents` array here again,
// however small, is the corpus back on first paint.
test("a document's text is in its own entry, and the manifest carries none", () => {
  const { documents, manifest } = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }, [["notes.md", "# hello"]]), {}, 3),
    NOTHING_HELD,
  )

  expect([...documents.entries.keys()]).toEqual(["notes.md"])
  expect(documents.entries.get("notes.md")).toEqual({ rev: 3, text: "# hello" })
  expect(manifest).toEqual({ rev: 3 })
})

test("a document that left the directory is a remove of its key", () => {
  const held = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }, [["notes.md", "# hello"]])),
    NOTHING_HELD,
  )
  const published = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    { outlines: held.outlines.entries, documents: held.documents.entries },
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
      setOf({ "house.jsonl": HOUSE, "garden.jsonl": GARDEN }, [["notes.md", "# hello"]]),
    ),
    NOTHING_HELD,
  )
  const second = publishedOf(
    revision(
      setOf({
        "house.jsonl": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.jsonl": GARDEN,
      }, [["notes.md", "# hello"]]),
      { changed: ["house.jsonl"] },
      2,
    ),
    { outlines: first.outlines.entries, documents: first.documents.entries },
  )

  expect(second.outlines.entries.get("garden.jsonl")).toBe(
    first.outlines.entries.get("garden.jsonl")!,
  )
  expect(second.outlines.entries.get("garden.jsonl")?.rev).toBe(1)
  expect(second.outlines.entries.get("house.jsonl")?.rev).toBe(2)
  // An untouched document is not re-published either — which is what keeps an
  // open reader's body from arriving again every time a neighbour is saved.
  expect(second.documents.entries.get("notes.md")).toBe(
    first.documents.entries.get("notes.md")!,
  )
  expect(second.documents.upserts).toEqual([])
})
