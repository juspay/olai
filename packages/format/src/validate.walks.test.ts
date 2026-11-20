import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Document, isOutline, type Outline, outlineDocument } from "./document.ts"
import { parseOutline } from "./fixtures.testlib.ts"
import { assemble, type OutlineSet, withDocuments } from "./set.ts"
import { following, type Reading, reading } from "./validate.ts"

interface Tripwire {
  reads: number
}

const watched = (set: OutlineSet, tripwire: Tripwire): OutlineSet => ({
  documents: set.documents.map((document) => {
    if (!isOutline(document)) return document
    const { nodes, ...rest } = document
    return Object.defineProperty({ ...rest }, "nodes", {
      get: () => {
        tripwire.reads++
        return nodes
      },
      enumerable: true,
    }) as Document
  }),
  broken: set.broken,
})

const vault = (files: number): OutlineSet => {
  const decoded = new Map<string, Result.Result<Document, never>>()
  decoded.set("_olai/Trash.olai", Result.succeed(outlineDocument(TEST_CLAIMS, "_olai/Trash.olai", [])))
  for (let which = 0; which < files; which++) {
    const path = `wing/room-${String(which).padStart(4, "0")}.olai`
    const text = [0, 1, 2]
      .map((row) => `{"id":"n${which}-${row}","ord":"a${row}","title":"row ${row}"}`)
      .join("\n")
    const read = parseOutline(path, text, TEST_CLAIMS)
    if (Result.isFailure(read)) throw new Error(`fixture ${path} does not parse`)
    decoded.set(path, Result.succeed<Document>(read.success))
  }
  return assemble(TEST_CLAIMS, decoded)
}

const written = (path: string, title: string): Outline => {
  const id = path.replace(/[^A-Za-z0-9_-]/g, "-")
  const read = parseOutline(path, `{"id":"${id}","ord":"a0","title":"${title}"}`, TEST_CLAIMS)
  if (Result.isFailure(read)) throw new Error(`${path} does not parse`)
  return read.success
}

const checked = (read: Reading, one: Outline): Reading =>
  reading(TEST_CLAIMS, withDocuments(read.set, [one]), {
    read,
    delta: { upserts: [[one.path, { nodes: one.nodes }]], removes: [] },
  })

const bothWays = (
  files: number,
  path: string,
): {
  readonly carriedReads: number
  readonly checkedReads: number
  readonly carried: Reading
  readonly checked: Reading
} => {
  const tripwire: Tripwire = { reads: 0 }
  const read = reading(TEST_CLAIMS, watched(vault(files), tripwire))
  const one = written(path, "rewritten")

  tripwire.reads = 0
  const carried = following(read, [one])
  const carriedReads = tripwire.reads

  tripwire.reads = 0
  const asChecked = checked(read, one)
  const checkedReads = tripwire.reads

  return { carriedReads, checkedReads, carried, checked: asChecked }
}

test("the two doors answer the same reading of the same write", () => {
  for (const path of [
    "wing/room-0007.olai",
    "aaa.olai",
  ]) {
    const { carried, checked: asChecked } = bothWays(40, path)
    expect([path, carried.set.documents]).toEqual([path, asChecked.set.documents])
    expect([path, carried.set.broken]).toEqual([path, asChecked.set.broken])
    expect([path, [...carried.derived.byFile.keys()]])
      .toEqual([path, [...asChecked.derived.byFile.keys()]])
    expect([path, carried.derived.nodes]).toEqual([path, asChecked.derived.nodes])
    expect([path, [...carried.derived.byId.keys()]])
      .toEqual([path, [...asChecked.derived.byId.keys()]])
  }
})

test("the records a write reads stop being the directory's", () => {
  const small = bothWays(50, "wing/room-0007.olai")
  const large = bothWays(500, "wing/room-0007.olai")

  expect(large.checkedReads).toBeGreaterThan(small.checkedReads * 2)
  expect(large.checkedReads).toBeGreaterThan(500 * 3)
  expect([small.carriedReads, large.carriedReads]).toEqual([2, 2])
})


test("a write with nothing left to patch onto rebuilds, on either door", () => {
  const set = assemble(TEST_CLAIMS,
    new Map<string, Result.Result<Document, never>>([
      ["only.olai", Result.succeed<Document>(written("only.olai", "the one file"))],
    ]),
  )
  const read = reading(TEST_CLAIMS, set)
  const one = written("only.olai", "rewritten")
  const carried = following(read, [one])
  const asChecked = checked(read, one)

  expect([carried.derived.byId instanceof Map, asChecked.derived.byId instanceof Map])
    .toEqual([true, true])
  expect(carried.derived.nodes).toEqual(asChecked.derived.nodes)
  expect(carried.derived.byId.get("only-olai")?.node).toMatchObject({ title: "rewritten" })
})
