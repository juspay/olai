/**
 * WHAT TWO DOORS TOUCH — the paths a capture is aimed by, and the homes a fold
 * click asks about.
 *
 * Two of the ops bundle's four costs are answered here, and both are the same
 * shape of claim: the ANSWER is what it was, and the WALK is gone. So each has
 * two cases — an equality against the computation it replaced, and a count.
 *
 * ## `perf-capture-paths`
 *
 * Resolving where a capture lands reads the outline PATHS, and the only reading
 * a face with no store could get was the LISTING — which counts the regular
 * records of every file in the directory to answer with a `nodes` and a `roots`
 * that the resolution throws away, twice when the capture race makes it resolve
 * again. {@link Query.paths} is the same question with the records left out. The
 * equality is that the paths are the listing's own files, in the listing's own
 * order; the count is that answering it touches no record at all.
 *
 * ## `perf-homes-files`
 *
 * The fold memory asks where a handful of remembered ids now live and which of
 * a handful of files the set has anything from — once per fold and unfold
 * somebody presses. The id half was always a lookup. The file half built a
 * `Set` of every outline path in the directory and a map of every broken file,
 * per call, under a comment that said neither half was a walk. Both are held
 * with the set now, so the answer costs the size of the QUESTION. The equality
 * is against the walk the comment described; the count is that asking twice
 * costs what asking once costs.
 *
 * ## How the counting works
 *
 * BY WRAPPING WHAT THE ANSWER IS MADE OF rather than by instrumenting the
 * answer: the derivation's by-file grouping and the set's document list are
 * handed over as counting proxies, so what is measured is records and paths
 * TOUCHED — the same trick `@olai/server`'s published bench plays with `Map`,
 * and for its reason. An arm that had to be told it was being measured would be
 * measuring something else.
 */

import {
  type Derived,
  type Located,
  type OutlineSet,
  outlinePaths,
} from "@olai/format"
import { expect, test } from "bun:test"

import { readingOf, setOf } from "./fixtures.testlib.ts"
import * as Query from "./query.ts"

/** A directory with records in every file, one file the set could not read, and
 *  the documents beside them — so a walk of the corpus and a walk of the file
 *  list are different sizes and a count can tell them apart. */
const FILES = 12
const RECORDS = 20

const vault = (): OutlineSet =>
  setOf(
    Object.fromEntries(
      Array.from({ length: FILES }, (_, file) => [
        `wing/room-${String(file).padStart(2, "0")}.olai`,
        Array.from(
          { length: RECORDS },
          (_, record) =>
            `{"id":"n${file}-${record}","ord":"a${record}","title":"row ${record}"}`,
        ).join("\n"),
      ]),
    ),
    [["notes/plan.md", "# Plan\n"]],
    { "torn.olai": `{"id":"torn"` },
  )

/** What one answer touched: records reached through the grouping, and paths
 *  reached through the document list. */
interface Touched {
  records: number
  paths: number
}

/**
 * The same reading, over structures that count what is read of them.
 *
 * A `Proxy` on the `documents` array counts an ELEMENT read, which is what a
 * `.filter` or a `.map` over it spends per file and a binary search spends per
 * comparison; a `Map` subclass over `byFile` counts a `get`, and the records it
 * hands back are counted as the list they are. Nothing about either changes an
 * answer — both delegate — so the two arms below are the real ones.
 */
const counting = (set: OutlineSet, derived: Derived) => {
  const touched: Touched = { records: 0, paths: 0 }
  const documents = new Proxy(set.documents as Array<unknown>, {
    get(held, key) {
      if (typeof key === "string" && /^\d+$/.test(key)) touched.paths += 1
      return Reflect.get(held, key)
    },
  })
  const held = new Map<string, ReadonlyArray<Located>>(derived.byFile)
  const byFile = new Proxy(held, {
    get(map, key, receiver) {
      if (key !== "get") return Reflect.get(map, key, receiver)
      return (file: string) => {
        const found = map.get(file)
        if (found !== undefined) touched.records += found.length
        return found
      }
    },
  })
  return {
    touched,
    set: { documents, broken: set.broken } as unknown as OutlineSet,
    derived: { ...derived, byFile } as Derived,
  }
}

// ── perf-capture-paths ─────────────────────────────────────────────────

test("the paths question answers the listing's own files, in its own order", () => {
  const set = vault()
  const derived = readingOf(set).derived
  // THE LISTING is the computation this replaced — a capture read it and kept
  // the file names. So that is the reference arm, and it is the product's own
  // listing rather than a re-derivation of it.
  const listed = Query.outlines(set, derived).map((row) => row.file)
  expect(Query.paths(set).paths).toEqual(listed)
  // A file the set could not READ is a file the directory serves, so it is in
  // the answer — which matters for the one caller: an inbox nobody can parse is
  // still the inbox, and minting a second one over it is the worse answer.
  expect(Query.paths(set).paths).toContain("torn.olai")
})

test("...and answering it touches no record", () => {
  const at = readingOf(vault())
  const listing = counting(at.set, at.derived)
  Query.outlines(listing.set, listing.derived)
  // The listing materialises the corpus: every regular record of every file,
  // filtered and counted, for a row that carries a number and a title list.
  expect(listing.touched.records).toBe(FILES * RECORDS)

  const asking = counting(at.set, at.derived)
  Query.paths(asking.set)
  // The paths question reads the FILE LIST and nothing under it.
  expect(asking.touched.records).toBe(0)
  expect(asking.touched.paths).toBeGreaterThan(0)
  expect(asking.touched.paths).toBeLessThanOrEqual(at.set.documents.length)
})

// ── perf-homes-files ───────────────────────────────────────────────────

/** The file half as the comment used to describe it — a fresh `Set` of every
 *  outline path and a fresh map of every broken file, per call. The reference
 *  arm, kept here because the claim is that the answer did not move. */
const walkedLoaded = (
  set: OutlineSet,
  files: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const served = new Set(outlinePaths(set))
  const broken = new Map(set.broken.map((entry) => [entry.file, entry.errors]))
  return [...new Set(files)].filter((file) => served.has(file) && !broken.has(file))
}

test("homes answers what the walk answered", () => {
  const at = readingOf(vault())
  const asked = [
    "wing/room-00.olai",
    "wing/room-07.olai",
    "torn.olai",
    "notes/plan.md",
    "nowhere.olai",
    "wing/room-00.olai",
  ]
  const answer = Query.homes(at, { ids: ["n0-0", "n7-3", "nobody"], files: asked })
  expect(answer.loaded).toEqual(walkedLoaded(at.set, asked))
  expect(answer.homes).toEqual([
    { id: "n0-0", file: "wing/room-00.olai" },
    { id: "n7-3", file: "wing/room-07.olai" },
  ])
})

test("...and a second fold click costs the question, not the directory", () => {
  const at = readingOf(vault())
  const counted = counting(at.set, at.derived)
  const asking = { ids: ["n0-0"], files: ["wing/room-00.olai", "nowhere.olai"] }

  // The reading, with the counting halves swapped in and the rest of it left
  // alone — the pointing index included, which this question does not read and
  // a literal would have to invent.
  const reading = { ...at, set: counted.set, derived: counted.derived }
  Query.homes(reading, asking)
  const first = counted.touched.paths
  // The FIRST ask builds the two readings the set holds — a walk of the file
  // list, once, which is what "held with the snapshot" means.
  expect(first).toBeGreaterThan(0)

  counted.touched.paths = 0
  for (let click = 0; click < 20; click++) {
    Query.homes(reading, asking)
  }
  // ...and every ask after it touches nothing at all: twenty fold clicks over
  // one revision cost twenty lookups.
  expect(counted.touched.paths).toBe(0)
  expect(counted.touched.records).toBe(0)
})
