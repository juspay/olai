import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { addressOf, printAddress } from "./address.ts"
import { referencesOf } from "./backlinks.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import { seeded } from "./fixtures.testlib.ts"
import { pointingOf } from "./pointing.ts"
import {
  addressesIn,
  facesIn,
  linkyRevisions,
  linkyVault,
  type Revision,
  sampledAddresses,
  scannedReferrers,
} from "./pointing.testlib.ts"
import { decodedVault, vaultAt } from "./scope.testlib.ts"
import { assemble, nodesIn, type OutlineSet } from "./set.ts"
import { type Reading, reading } from "./validate.ts"

interface Report {
  readonly divergences: ReadonlyArray<string>
  readonly stale: ReadonlyArray<string>
  readonly revisions: number
  readonly asked: number
  readonly hits: number
  readonly carried: number
  readonly keys: number
}

const replay = (revisions: Iterable<Revision>, every = 1): Report => {
  const divergences: Array<string> = []
  const stale: Array<string> = []
  const decoded = new Map<string, Result.Result<Document, Verdict>>()
  let held: Revision = new Map()
  let previous: Reading | null = null
  let revisionsSeen = 0
  let asked = 0
  let hits = 0
  let carried = 0
  let keys = 0
  for (const revision of revisions) {
    revisionsSeen++
    const changed: Array<string> = []
    const removes: Array<string> = []
    for (const file of held.keys()) {
      if (!revision.has(file)) {
        decoded.delete(file)
        removes.push(file)
      }
    }
    const moved = new Map<string, string>()
    for (const [file, text] of revision) {
      if (held.get(file) !== text) moved.set(file, text)
    }
    for (const [file, one] of decodedVault(moved)) {
      decoded.set(file, one)
      changed.push(file)
    }
    held = revision
    const set = assemble(TEST_CLAIMS, decoded)
    const at: Reading = previous === null ? reading(TEST_CLAIMS, set) : reading(TEST_CLAIMS, set, {
      read: previous,
      delta: {
        upserts: changed.map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes,
      },
    })
    if (previous !== null && at.pointing === previous.pointing) carried++
    keys = Math.max(keys, at.pointing.size)

    const rebuilt = pointingOf(TEST_CLAIMS, set.documents)
    if (!sameIndex(at.pointing, rebuilt)) {
      stale.push(`revision ${revisionsSeen}: ${storyOf(at.pointing, rebuilt)}`)
    }

    const faces = facesIn(set)
    for (const address of every === 1 ? addressesIn(set) : sampledAddresses(set, every)) {
      asked++
      const found = referencesOf(at, address)
      const walked = scannedReferrers(address, faces, at.derived)
      if (found.length > 0) hits++
      if (!sameReferrers(found, walked)) {
        divergences.push(
          `revision ${revisionsSeen}, ${printAddress(address)}: ` +
            `index ${said(found)} vs scan ${said(walked)}`,
        )
      }
    }
    previous = at
  }
  return { divergences, stale, revisions: revisionsSeen, asked, hits, carried, keys }
}

const said = (found: ReadonlyArray<{ source: { node?: { id: string }; path?: string }; ways: ReadonlyArray<string> }>) =>
  found.map((one) =>
    `${"path" in one.source ? one.source.path : one.source.node?.id}${one.ways.join("+")}`
  ).join(",")

const sameReferrers = (
  found: ReadonlyArray<{ source: { node?: { id: string }; path?: string }; ways: ReadonlyArray<string> }>,
  walked: ReadonlyArray<{ source: { node?: { id: string }; path?: string }; ways: ReadonlyArray<string> }>,
): boolean => {
  if (said(found) !== said(walked)) return false
  return found.every((one, at) => sameFaceValue(one.source, walked[at]?.source))
}

const sameFaceValue = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other)

const sameIndex = (
  found: ReadonlyMap<string, ReadonlyArray<{ face: { path: string } }>>,
  rebuilt: ReadonlyMap<string, ReadonlyArray<{ face: { path: string } }>>,
): boolean => {
  if (found.size !== rebuilt.size) return false
  for (const [key, own] of found) {
    const other = rebuilt.get(key)
    if (other === undefined || own.length !== other.length) return false
    if (own.some((face, at) => JSON.stringify(face) !== JSON.stringify(other[at]))) return false
  }
  return true
}

const storyOf = (
  found: ReadonlyMap<string, ReadonlyArray<{ face: { path: string } }>>,
  rebuilt: ReadonlyMap<string, ReadonlyArray<{ face: { path: string } }>>,
): string => {
  const keys = new Set([...found.keys(), ...rebuilt.keys()])
  const wrong: Array<string> = []
  for (const key of keys) {
    const own = found.get(key)
    const other = rebuilt.get(key)
    const one = own === undefined ? "absent" : own.map((source) => source.face.path).join(",")
    const two = other === undefined ? "absent" : other.map((source) => source.face.path).join(",")
    if (one !== two) wrong.push(`\`${key}\`: carried ${one} — rebuilt ${two}`)
  }
  return wrong.join("; ")
}

const REVISIONS = 300

test("the index answers what the scan answered, over generated corpora", () => {
  const random = seeded(20260825)
  const report = replay(linkyRevisions(linkyVault(), random, REVISIONS))
  expect(report.divergences).toEqual([])
  expect(report.stale).toEqual([])
  expect(report.revisions).toBe(REVISIONS + 1)
  expect(report.asked).toBeGreaterThan(5_000)
  expect(report.hits).toBeGreaterThan(1_000)
  expect(report.keys).toBeGreaterThan(5)
  expect(report.carried).toBeGreaterThan(15)
  expect(report.carried).toBeLessThan(REVISIONS)
})

test("…and over this repository's own website/docs/, edited", () => {
  const vault = vaultAt("website/docs")
  const random = seeded(20260826)
  const report = replay(linkyRevisions(vault, random, 60), 37)
  expect(report.divergences).toEqual([])
  expect(report.stale).toEqual([])
  expect(report.asked).toBeGreaterThan(500)
  expect(report.hits).toBeGreaterThan(50)
  expect(report.carried).toBeGreaterThan(3)
})

const readingOfVault = (files: Record<string, string>): Reading =>
  reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decodedVault(new Map(Object.entries(files)))))

const pointedAt = (at: Reading, path: string, element: string | null = null): string => {
  const address = addressOf(TEST_CLAIMS, path === "" ? null : path, element)
  if (address === null) return ""
  return referencesOf(at, address)
    .map((one) => ("path" in one.source ? String(one.source.path) : `${one.source.file}#${one.source.node.id}`))
    .join(",")
}

test("a link onto a heading is filed under the heading and under the document", () => {
  const at = readingOfVault({
    "a.olai": `{"id":"n","ord":"a0","title":"see [the scope](brief.md#scope)"}`,
    "brief.md": "# Brief\n\n## Scope\n\n## Risks\n",
  })
  expect(pointedAt(at, "brief.md")).toBe("a.olai#n")
  expect(pointedAt(at, "brief.md", "scope")).toBe("a.olai#n")
  expect(pointedAt(at, "brief.md", "risks")).toBe("")
})

test("a face writing a document and one of its headings is one referrer", () => {
  const at = readingOfVault({
    "notes.md": "# Notes\n\n[whole](brief.md) and [part](brief.md#scope)\n",
    "brief.md": "# Brief\n\n## Scope\n",
  })
  expect(pointedAt(at, "brief.md")).toBe("notes.md")
})

test("a path that starts with a `#` is filed apart from the node arm", () => {
  const at = readingOfVault({
    "a.olai": [
      `{"id":"points","ord":"a0","title":"at the file","desc":"[document](./%23odd.md)"}`,
      `{"id":"odd","ord":"a1","title":"a node called odd"}`,
      `{"id":"names","ord":"a2","title":"at the node","see":["odd"]}`,
    ].join("\n"),
    "#odd.md": "# Odd\n",
  })
  expect(pointedAt(at, "#odd.md")).toBe("a.olai#points")
  expect(pointedAt(at, "", "odd")).toBe("a.olai#names")
})

test("the referrers come back in path order, whichever way the index got there", () => {
  const body = "# Note\n\n[to](../target.md)\n"
  const target = "# Target\n"
  const first = readingOfVault({
    "b/two.md": body,
    "target.md": target,
    "a/one.md": body,
  })
  expect(pointedAt(first, "target.md")).toBe("a/one.md,b/two.md")
  const before = readingOfVault({ "b/two.md": body, "target.md": target })
  const after = reading(TEST_CLAIMS,
    assemble(TEST_CLAIMS,
      decodedVault(
        new Map([["b/two.md", body], ["target.md", target], ["a/one.md", body]]),
      ),
    ),
    { read: before, delta: { upserts: [["a/one.md", { nodes: [] }]], removes: [] } },
  )
  expect(pointedAt(after, "target.md")).toBe("a/one.md,b/two.md")
})

test("a body write that leaves the face alone carries the index by reference", () => {
  const decoded = decodedVault(
    new Map([
      ["a.olai", `{"id":"n","ord":"a0","title":"n","desc":"[document](brief.md)"}`],
      ["brief.md", "# Brief\n\nthe first draft\n"],
    ]),
  )
  const before = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
  decoded.set("brief.md", Result.succeed<Document>(bodiedDocument(TEST_CLAIMS, "brief.md", "# Brief\n\nthe second draft\n")))
  const after = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded), {
    read: before,
    delta: { upserts: [["brief.md", { nodes: [] }]], removes: [] },
  })
  expect(after.set.documents[1]).not.toBe(before.set.documents[1])
  expect(after.pointing).toBe(before.pointing)
  expect(pointedAt(before, "brief.md")).toBe("a.olai#n")
})

test("a body write that moves a link re-files it, and an emptied key goes away", () => {
  const before = readingOfVault({
    "notes.md": "# Notes\n\n[to](one.md)\n",
    "one.md": "# One\n",
    "two.md": "# Two\n",
  })
  expect(pointedAt(before, "one.md")).toBe("notes.md")
  const files = decodedVault(
    new Map([
      ["notes.md", "# Notes\n\n[to](two.md)\n"],
      ["one.md", "# One\n"],
      ["two.md", "# Two\n"],
    ]),
  )
  const after = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, files), {
    read: before,
    delta: { upserts: [["notes.md", { nodes: [] }]], removes: [] },
  })
  expect(pointedAt(after, "one.md")).toBe("")
  expect(pointedAt(after, "two.md")).toBe("notes.md")
  expect(after.pointing.has("one.md")).toBe(false)
})
