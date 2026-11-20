import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"
import { Result } from "effect"

import type { Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import { isMirror } from "./node.ts"
import { parseOutline } from "./fixtures.testlib.ts"
import {
  type Ask,
  asksOver,
  decodedVault,
  deepVaultOf,
  differential,
  pinnedVault,
  readingOfVault,
  TANGLED,
  vaultAt,
  referenceMatching,
} from "./scope.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { reading } from "./validate.ts"
import { verdictOf } from "./verdict.ts"

const NOW = "2026-08-13T11:00:00-04:00"

const QUERIES: ReadonlyArray<string> = [
  "kitchen",
  "garden",
  "walnut",
  "record",
  `"a note about"`,
  "kitchen OR garden",
  "kitchen -walnut",
  "is:todo",
  "is:done",
  "has:desc",
  "date:2026-08",
  "zzzzzzzz",
  "kitchen is:trashed",
]

const holds = (report: ReturnType<typeof differential>, floors: {
  readonly hits: number
  readonly narrowing: number
}): void => {
  expect(report.divergences).toEqual([])
  expect(report.hits).toBeGreaterThan(floors.hits)
  expect(report.narrowing).toBeGreaterThan(floors.narrowing)
}

test("the corners a generator cannot reach agree, scope by scope", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  holds(
    differential(at, asksOver(at.derived, QUERIES), NOW),
    { hits: 40, narrowing: 20 },
  )
})

test("a record written beneath a placement is under nothing above that placement", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  const found = (under: string): ReadonlyArray<string> =>
    matching(at.derived, parseFilter("kitchen", NOW), { under }).map((one) => one.at.node.id)

  expect(found("t-root")).toEqual(["t-cross", "t-root", "t-live", "t-inner"])
  expect(
    matching(at.derived, parseFilter("kitchen", NOW), {
      under: "t-root",
      file: "tangled.olai",
    }).map((one) => one.at.node.id),
  ).toEqual(["t-root", "t-live", "t-inner"])
  expect(found("t-root")).not.toContain("t-beneath")
  expect(found("t-beneath")).toEqual(["t-beneath", "t-deeper"])
  expect(found("t-place")).toEqual([])
  expect(found("t-chain")).toEqual([])
  const inFile = (under: string): ReadonlyArray<string> =>
    matching(at.derived, parseFilter("kitchen", NOW), { under, file: "tangled.olai" })
      .map((one) => one.at.node.id)
  expect(inFile("t-place")).toEqual([])
  expect(inFile("t-nobody")).toEqual([])
  expect(found("t-target")).toEqual(["t-target", "t-target-child"])
  expect(found("t-loop-a")).toEqual(["t-loop-a", "t-loop-b"])
  expect(found("t-loop-b")).toEqual(["t-loop-a", "t-loop-b"])
  expect(found("t-nobody")).toEqual([])
  expect(found("t-orphan")).toEqual(["t-orphan"])
  expect(found("t-gone")).toEqual([])
  expect(
    matching(at.derived, parseFilter("kitchen is:trashed", NOW), { under: "t-gone" })
      .map((one) => one.at.node.id),
  ).toEqual(["t-gone", "t-gone-child"])
})

test("an `under:` scope through a mirror admits each record once and no more", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  const ids = matching(at.derived, parseFilter("kitchen OR garden", NOW), {}).map((one) =>
    one.at.node.id
  )
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).not.toContain("t-place")
  for (const under of ["t-root", "t-far", "t-target", "t-place"]) {
    const scoped = matching(at.derived, parseFilter("kitchen OR garden", NOW), { under })
      .map((one) => one.at.node.id)
    expect(new Set(scoped).size).toBe(scoped.length)
  }
})

test("a generated vault with depth in it agrees at every scope", () => {
  const vault = deepVaultOf({ files: 60, records: 24 })
  const at = readingOfVault(vault)
  expect(at.derived.byId.size).toBe(at.derived.nodes.length)
  const placements = at.derived.nodes.filter((one) => isMirror(one.node))
  expect(placements.length).toBeGreaterThan(50)
  expect(beneathPlacements(at.derived)).toBeGreaterThan(50)
  expect(deepest(at.derived)).toBeGreaterThan(3)
  holds(
    differential(at, asksOver(at.derived, QUERIES), NOW),
    { hits: 500, narrowing: 100 },
  )
})

const beneathPlacements = (derived: Derived): number => {
  let count = 0
  for (const at of derived.nodes) {
    const parent = at.node.parent === undefined ? undefined : derived.byId.get(at.node.parent)
    if (parent !== undefined && isMirror(parent.node)) count += 1
  }
  return count
}

const deepest = (derived: Derived): number => {
  const depths = new Map<string, number>()
  const depthOf = (id: string, seen: ReadonlySet<string>): number => {
    const held = depths.get(id)
    if (held !== undefined) return held
    const at = derived.byId.get(id)
    const parent = at?.node.parent
    const above = parent === undefined || seen.has(parent)
      ? 0
      : depthOf(parent, new Set([...seen, parent]))
    const depth = above + 1
    depths.set(id, depth)
    return depth
  }
  let most = 0
  for (const at of derived.nodes) most = Math.max(most, depthOf(at.node.id, new Set([at.node.id])))
  return most
}

const VAULT = pinnedVault()

test("the real vault agrees at every scope", () => {
  const vault = vaultAt(VAULT)
  const at = readingOfVault(vault)
  expect(at.derived.nodes.length).toBeGreaterThan(100)
  expect(at.derived.byFile.size).toBeGreaterThan(4)
  expect(at.derived.byId.size).toBe(at.derived.nodes.length)
  holds(
    differential(at, asksOver(at.derived, REAL), NOW),
    { hits: 20, narrowing: 5 },
  )
})

const REAL: ReadonlyArray<string> = [
  "the",
  "index",
  "outline-olai",
  "search",
  `"the human"`,
  "index OR search",
  "index -search",
  "is:todo",
  "is:done",
  "has:desc",
  "zzzzzzzz",
  "the is:trashed",
]

test("a write leaves the narrowing answering what the walk does", () => {
  const vault = new Map(deepVaultOf({ files: 12, records: 18, seed: 20260825 }))
  const decoded = decodedVault(vault)
  let read = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
  const asks = asksOver(read.derived, QUERIES, { files: 6, roots: 10 })
  holds(differential(read, asks, NOW), { hits: 60, narrowing: 20 })

  const asking = (): ReadonlyArray<Ask> => [
    ...asks,
    ...asksOver(read.derived, QUERIES, { files: 6, roots: 10 }),
  ]

  const moved: Array<string> = []
  const say = (): string =>
    ["d3n1", "d4r", "d8r", "d6r"]
      .map((under) =>
        referenceMatching(read.derived, parseFilter("kitchen OR garden", NOW), { under })
          .map((one) => one.at.node.id).join(",")
      )
      .join(" | ")
  moved.push(say())

  const rewritten = (file: string, edit: (text: string) => string): void => {
    const text = vault.get(file) as string
    const edited = edit(text)
    if (edited === text) throw new Error(`the edit to ${file} changed nothing`)
    vault.set(file, edited)
    decoded.set(file, Result.mapError(parseOutline(file, edited, TEST_CLAIMS), verdictOf))
  }
  const requeried = (changed: ReadonlyArray<string>, removed: ReadonlyArray<string>): void => {
    read = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded), {
      read,
      delta: {
        upserts: changed.map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes: [...removed],
      },
    })
    expect(read.derived.byId.size).toBe(read.derived.nodes.length)
    holds(differential(read, asking(), NOW), { hits: 40, narrowing: 15 })
    moved.push(say())
  }

  rewritten(
    "deep3.olai",
    (text) => text.replace(/^\{"id":"d3n17","parent":"[^"]*"/m, `{"id":"d3n17","parent":"d3n1"`),
  )
  requeried(["deep3.olai"], [])

  rewritten(
    "deep4.olai",
    (text) =>
      text.replace(/^\{"id":"d4n1".*$/m, `{"id":"d4n1","parent":"d4r","ord":"a1","mirror":"d3r"}`),
  )
  requeried(["deep4.olai"], [])

  rewritten("deep8.olai", (text) => text.replaceAll(`"d8`, `"e8`))
  requeried(["deep8.olai"], [])

  vault.delete("deep6.olai")
  decoded.delete("deep6.olai")
  requeried([], ["deep6.olai"])
  expect(matching(read.derived, parseFilter("kitchen", NOW), { under: "d6r" })).toEqual([])
  expect(matching(read.derived, parseFilter("kitchen", NOW), { file: "deep6.olai" })).toEqual([])

  expect(moved.length).toBe(5)
  expect(new Set(moved).size).toBe(moved.length)
})

test("a scoped query never reads the corpus", () => {
  const at = readingOfVault(deepVaultOf({ files: 40, records: 20, seed: 20260826 }))
  const blind = withoutCorpus(at.derived)
  const file = [...at.derived.byFile.keys()][3] as string
  const asked = parseFilter("kitchen OR garden", NOW)
  for (const scope of [{ file }, { under: "d9n1" }, { under: "d9n1", file: "deep9.olai" }]) {
    expect(matching(blind, asked, scope)).toEqual(matching(at.derived, asked, scope))
    expect(matching(at.derived, asked, scope).length).toBeGreaterThan(0)
  }
  const named = [
    ...(at.derived.byFile.get("deep9.olai") ?? []),
    ...(at.derived.byFile.get(file) ?? []),
  ].map((one) => one.node.id)
  const off = matching(at.derived, asked, { under: "d9r" }, named)
  expect(off.length).toBeGreaterThan(0)
  expect(off.length).toBeLessThan(named.length)
  expect(matching(blind, asked, { under: "d9r" }, named)).toEqual(off)
  expect(() => matching(blind, asked, {})).toThrow(/read the whole corpus/)
})

const withoutCorpus = (derived: Derived): Derived => ({
  ...derived,
  get nodes(): never {
    throw new Error("a scoped query read the whole corpus")
  },
})
