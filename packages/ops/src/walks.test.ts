import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import {
  type Derived,
  type Located,
  type OutlineSet,
  outlinePaths,
} from "@olai/format"
import { expect, test } from "bun:test"

import { readingOf, setOf } from "./fixtures.testlib.ts"
import * as Query from "./query.ts"

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

interface Touched {
  records: number
  paths: number
}

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

test("the paths question answers the listing's own files, in its own order", () => {
  const set = vault()
  const derived = readingOf(set).derived
  const listed = Query.outlines(set, derived).map((row) => row.file)
  expect(Query.paths(TEST_CLAIMS, "outline-olai", set).paths).toEqual(listed)
  expect(Query.paths(TEST_CLAIMS, "outline-olai", set).paths).toContain("torn.olai")
})

test("...and answering it touches no record", () => {
  const at = readingOf(vault())
  const listing = counting(at.set, at.derived)
  Query.outlines(listing.set, listing.derived)
  expect(listing.touched.records).toBe(FILES * RECORDS)

  const asking = counting(at.set, at.derived)
  Query.paths(TEST_CLAIMS, "outline-olai", asking.set)
  expect(asking.touched.records).toBe(0)
  expect(asking.touched.paths).toBeGreaterThan(0)
  expect(asking.touched.paths).toBeLessThanOrEqual(at.set.documents.length)
})

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

  const reading = { ...at, set: counted.set, derived: counted.derived }
  Query.homes(reading, asking)
  const first = counted.touched.paths
  expect(first).toBeGreaterThan(0)

  counted.touched.paths = 0
  for (let click = 0; click < 20; click++) {
    Query.homes(reading, asking)
  }
  expect(counted.touched.paths).toBe(0)
  expect(counted.touched.records).toBe(0)
})
