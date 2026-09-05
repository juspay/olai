/**
 * A SCOPE AND AN INDEX NARROW THE SAME SEARCH, and must select the same
 * records.
 *
 * `@olai/format`'s own `scope.test.ts` holds the scoped walk to the corpus walk
 * it replaced. This holds the pair to each other: the index answers a query
 * with the records that MIGHT match and the scope answers it with the corner
 * that was asked about, and the two narrowings meet in one call. They are
 * different shapes of restriction — a list of ids resolved through `byId`
 * against a subtree descended through `children` — and the way that composition
 * breaks is not by throwing, it is by an answer quietly missing a record that
 * only one of the two knew to keep.
 *
 * IT IS THE SAME HARNESS, deliberately (`@olai/format/testlib/scope`): the same
 * asks, the same corpora, and the same reference walk, run with the index
 * plugged into it. A second differential written here would be a second opinion
 * about what a scope means, which is exactly the drift the shared door exists
 * to stop — and the reference walk it compares against is the code that shipped
 * before either narrowing existed, which neither of them can be graded by if it
 * lives beside them.
 *
 * WHAT IS ASKED OF THE INDEX BESIDE THAT is that it really answered: a run
 * where every query fell back to the corpus would compare two unnarrowed walks
 * all night and pass, so the counters below insist on asks that went through a
 * candidate list AND asks that did not.
 */

import {
  asksOver,
  decodedVault,
  deepVaultOf,
  differential,
  readingOfVault,
  TANGLED,
} from "@olai/format/testlib/scope"
import { assemble, nodesIn, parseOutline, reading, verdictOf } from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Index, open } from "./table.ts"

/** The moment the grammar's relative words count from — a constant, for the
 *  reason every fixture here has one. */
const NOW = "2026-08-13T11:00:00-04:00"

/** Words the corpora below actually hold, so the comparison is between two
 *  answers rather than between two empty ones, plus the shapes that reach the
 *  index's own edges: a needle under the trigram floor, an `OR`, a negation and
 *  a query of operators alone all leave it with nothing to look up, and those
 *  asks must still be scoped identically. */
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

/** Opened per test and closed after it, so a failing case leaves no table
 *  behind and no case is answered out of another's rows — `./table.test.ts`'s
 *  rule, for its reason. */
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
    // The index really answered some of them, and really declined others.
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
    // ...and the same asks with no index at all, which is what every caller
    // that has none is doing: the third answer this suite compares, and the
    // reason a scope may not mean one thing to a candidate list and another to
    // a corpus.
    expect(differential(at, asks, NOW).divergences).toEqual([])
  } finally {
    index.close()
  }
})

test("a write leaves the two narrowings still agreeing", () => {
  const index = opened()
  try {
    const vault = new Map(deepVaultOf({ files: 12, records: 18, seed: 20260825 }))
    const decoded = decodedVault(vault)
    let read = reading(assemble(decoded))
    const asks = asksOver(read.derived, QUERIES, { files: 6, roots: 10 })
    const narrow = (at: typeof read, filter: Parameters<Index["narrow"]>[1]) =>
      index.narrow(at, filter)?.nodes

    const holds = (): void => {
      // The fixture is a set the validator would take — the one corpus where a
      // candidate list and a corpus walk may legitimately differ is a set with
      // two records claiming one id, and a divergence reported over one would
      // be about this fixture rather than about either narrowing.
      expect(read.derived.byId.size).toBe(read.derived.nodes.length)
      const report = differential(read, asks, NOW, narrow)
      expect(report.divergences).toEqual([])
      expect(report.hits).toBeGreaterThan(40)
      expect(report.candidates).toBeGreaterThan(0)
    }
    holds()

    /** One file rewritten and the reading PATCHED, which is what the store
     *  hands a query on a settled keystroke — and what brings the index's own
     *  file table level with it on the next `narrow`. */
    const rewritten = (file: string, edit: (text: string) => string): void => {
      const text = vault.get(file) as string
      const edited = edit(text)
      if (edited === text) throw new Error(`the edit to ${file} changed nothing`)
      vault.set(file, edited)
      decoded.set(file, Result.mapError(parseOutline(file, edited), verdictOf))
      read = reading(assemble(decoded), {
        read,
        delta: { upserts: [[file, { nodes: nodesIn(decoded.get(file)) }]], removes: [] },
      })
      holds()
    }

    // A placement arriving over a live branch, which moves what the SCOPE
    // holds and leaves what the INDEX holds alone — the records under `d4n1`
    // still say every word they said, and are in no scope above it any more.
    rewritten(
      "deep4.olai",
      (text) =>
        text.replace(
          /^\{"id":"d4n1".*$/m,
          `{"id":"d4n1","parent":"d4r","ord":"a1","mirror":"d3r"}`,
        ),
    )
    // ...and the other way round: the text of a record changes and where it
    // hangs does not, which moves what the index holds and leaves the scope
    // alone.
    rewritten("deep7.olai", (text) => text.replaceAll("garden", "walnut"))
  } finally {
    index.close()
  }
})
