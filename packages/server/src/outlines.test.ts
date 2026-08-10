/**
 * The projection from one published revision to what the wire holds.
 *
 * Two properties are worth a test and neither is about outlines: every file the
 * set lists keeps a key, whatever it holds and whether or not it parsed; and
 * the per-tick change is the STORE's diff mapped onto the collection's verbs,
 * never a comparison of two sets — a document that changed is not an upsert,
 * and a key that was never held is not a remove.
 */

import type { OutlineSet } from "@olai/format"
import { setOf } from "@olai/format/testlib"
import type { Snapshot } from "@olai/store"
import { expect, test } from "bun:test"

import { type Entries, publishedOf } from "./outlines.ts"

const HOUSE = '{"id":"kitchen","ord":"a0","title":"kitchen"}\n'
const GARDEN = '{"id":"garden","ord":"a0","title":"garden"}\n'

/** A revision, moved however the caller says — by default everything, which is
 *  what a first probe reports. */
const revision = (
  value: OutlineSet,
  moved: { changed?: ReadonlyArray<string>; removed?: ReadonlyArray<string> } = {},
  rev = 1,
): Snapshot<OutlineSet> => ({
  rev,
  value,
  changed: moved.changed ?? value.files,
  removed: moved.removed ?? [],
})

const NOTHING_HELD: Entries = new Map()

test("every file the set lists gets an entry, at the set's revision", () => {
  const { entries } = publishedOf(
    revision(
      setOf({ "house.jsonl": HOUSE, "empty.jsonl": "" }, [["notes.md", "hello"]]),
      {},
      7,
    ),
    NOTHING_HELD,
  )

  expect([...entries.keys()]).toEqual(["house.jsonl", "empty.jsonl"])
  expect(entries.get("house.jsonl")).toEqual({
    rev: 7,
    nodes: setOf({ "house.jsonl": HOUSE }).nodes,
    broken: null,
  })
  // A file that holds nothing is still an outline somebody can open.
  expect(entries.get("empty.jsonl")).toEqual({ rev: 7, nodes: [], broken: null })
  // A document is not an entry: its text rides the manifest.
  expect(entries.has("notes.md")).toBe(false)
})

// The per-entity degrade, as data: the key stays and the errors are IN it, so
// the sidebar still lists the file and its own pane is what shows the trouble.
test("a file that did not parse keeps its key and carries its errors", () => {
  const { entries } = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }, [], { "shed.jsonl": "{" })),
    NOTHING_HELD,
  )

  const shed = entries.get("shed.jsonl")
  expect(shed?.nodes).toEqual([])
  expect(shed?.broken?.file).toBe("shed.jsonl")
  expect(shed?.broken?.errors.length).toBeGreaterThan(0)
  expect(entries.get("house.jsonl")?.broken).toBeNull()
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
    before.entries,
  )

  expect(published.upserts.map(([path]) => path)).toEqual(["house.jsonl"])
  expect(published.upserts[0]?.[1].rev).toBe(2)
  expect(published.removes).toEqual(["garden.jsonl"])
})

// A collection may not be told to drop a key it never had — the store talks
// about a directory, and a `.md` leaving it is not an outline leaving this.
test("a removed path that was never an entry is not a remove", () => {
  const held = publishedOf(revision(setOf({ "house.jsonl": HOUSE })), NOTHING_HELD)
  const published = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }), { changed: [], removed: ["notes.md"] }, 2),
    held.entries,
  )

  expect(published.removes).toEqual([])
})

test("the manifest carries the documents, text and all", () => {
  const { manifest } = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE }, [["notes.md", "# hello"]]), {}, 3),
    NOTHING_HELD,
  )

  expect(manifest).toEqual({ documents: [{ file: "notes.md", text: "# hello" }] })
})

// What the collection HOLDS is what it SAID: an untouched file keeps the entry
// it was published with, so the snapshot a fresh subscriber reads and the
// deltas an open one received cannot name different revisions for it.
test("a file that did not move keeps the entry it was published with", () => {
  const first = publishedOf(
    revision(setOf({ "house.jsonl": HOUSE, "garden.jsonl": GARDEN })),
    NOTHING_HELD,
  )
  const second = publishedOf(
    revision(
      setOf({
        "house.jsonl": `${HOUSE}{"id":"sink","parent":"kitchen","ord":"a0","title":"sink"}\n`,
        "garden.jsonl": GARDEN,
      }),
      { changed: ["house.jsonl"] },
      2,
    ),
    first.entries,
  )

  expect(second.entries.get("garden.jsonl")).toBe(first.entries.get("garden.jsonl")!)
  expect(second.entries.get("garden.jsonl")?.rev).toBe(1)
  expect(second.entries.get("house.jsonl")?.rev).toBe(2)
})
