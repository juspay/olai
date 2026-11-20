import { TEST_CLAIMS } from "@olai/format/testlib"
import {
  asksOver,
  decodedVault,
  deepVaultOf,
  differential,
  readingOfVault,
  TANGLED,
} from "@olai/format/testlib/scope"
import { assemble, nodesIn, reading, verdictOf } from "@olai/format"
import { parseOutline } from "olai-plugin-outline-olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Index, open } from "./table.ts"

const NOW = "2026-08-13T11:00:00-04:00"

const QUERIES: ReadonlyArray<string> = [
  "kitchen",
  "garden",
  "walnut",
  "record",
  `"a note about"`,
  "kitchen OR garden",
  "kitchen -walnut",
  "ab",
  "is:todo",
  "has:desc",
  "zzzzzzzz",
  "kitchen is:trashed",
]

const opened = (): Index => open()

test("a scope selects the same records off an index as off the corpus", () => {
  const index = opened()
  try {
    const at = readingOfVault(new Map(Object.entries(TANGLED)))
    const report = differential(
      at,
      asksOver(at.derived, QUERIES),
      NOW,
      (reading, filter) => index.narrow(reading, filter)?.nodes,
    )
    expect(report.divergences).toEqual([])
    expect(report.hits).toBeGreaterThan(40)
    expect(report.narrowing).toBeGreaterThan(20)
    expect(report.candidates).toBeGreaterThan(0)
    expect(report.asked - report.candidates).toBeGreaterThan(0)
  } finally {
    index.close()
  }
})

test("a scope and a candidate list compose over a vault with depth in it", () => {
  const index = opened()
  try {
    const at = readingOfVault(deepVaultOf({ files: 60, records: 24 }))
    const asks = asksOver(at.derived, QUERIES)
    const report = differential(
      at,
      asks,
      NOW,
      (reading, filter) => index.narrow(reading, filter)?.nodes,
    )
    expect(report.divergences).toEqual([])
    expect(report.hits).toBeGreaterThan(500)
    expect(report.narrowing).toBeGreaterThan(100)
    expect(report.candidates).toBeGreaterThan(asks.length / 4)
    // A scope may not mean one thing to a candidate list and another to a corpus.
    expect(differential(at, asks, NOW).divergences).toEqual([])
  } finally {
    index.close()
  }
}, 30_000)

test("a write leaves the two narrowings still agreeing", () => {
  const index = opened()
  try {
    const vault = new Map(deepVaultOf({ files: 12, records: 18, seed: 20260825 }))
    const decoded = decodedVault(vault)
    let read = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded))
    const asks = asksOver(read.derived, QUERIES, { files: 6, roots: 10 })
    const narrow = (at: typeof read, filter: Parameters<Index["narrow"]>[1]) =>
      index.narrow(at, filter)?.nodes

    const holds = (): void => {
      expect(read.derived.byId.size).toBe(read.derived.nodes.length)
      const report = differential(read, asks, NOW, narrow)
      expect(report.divergences).toEqual([])
      expect(report.hits).toBeGreaterThan(40)
      expect(report.candidates).toBeGreaterThan(0)
    }
    holds()

    const rewritten = (file: string, edit: (text: string) => string): void => {
      const text = vault.get(file) as string
      const edited = edit(text)
      if (edited === text) throw new Error(`the edit to ${file} changed nothing`)
      vault.set(file, edited)
      decoded.set(file, Result.mapError(parseOutline(file, edited, TEST_CLAIMS), verdictOf))
      read = reading(TEST_CLAIMS, assemble(TEST_CLAIMS, decoded), {
        read,
        delta: { upserts: [[file, { nodes: nodesIn(decoded.get(file)) }]], removes: [] },
      })
      holds()
    }

    rewritten(
      "deep4.olai",
      (text) =>
        text.replace(
          /^\{"id":"d4n1".*$/m,
          `{"id":"d4n1","parent":"d4r","ord":"a1","mirror":"d3r"}`,
        ),
    )
    rewritten("deep7.olai", (text) => text.replaceAll("garden", "walnut"))
  } finally {
    index.close()
  }
})
