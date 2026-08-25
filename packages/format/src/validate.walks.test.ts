/**
 * WHAT ONE WRITE INTO A READING COSTS IN RECORDS READ — and that it costs the
 * same ANSWER.
 *
 * `following` is what `@olai/ops`' batch fold does between two ops (roadmap
 * `perf-reading-patched-check`), and it replaced
 * `reading(withDocuments(set, written), {read, delta})`: the same splice and the
 * same patch, with a whole-corpus disagreement check on the end of them. That
 * check is `./validate.ts`'s `isSet`, and what it does is READ RECORDS — every
 * record of every outline the directory serves, per write, to establish that a
 * view built from a delta really is a view of the set in hand. Two claims come
 * out of taking it off the fold's door, and this file is both of them:
 *
 *   - THE ANSWER IS THE SAME ANSWER. The set, the grouping, the flat records
 *     and the id table, identical between the two doors over a generated
 *     directory — which is what makes the count below a statement about cost
 *     rather than about an arm that reported magnificently by answering
 *     nothing. (`@olai/ops`' `following.equivalence.test.ts` makes the same
 *     comparison op by op through a real batch; this one makes it here so the
 *     instrument beside it is honest on its own.)
 *   - THE CORPUS WALK IS GONE. Counted by TRIPWIRING THE RECORDS THEMSELVES,
 *     which is the only honest instrument for a cost whose whole shape is
 *     "which files did you look inside": every outline of the vault is wrapped
 *     so that asking it for its `nodes` is counted, the file being written is
 *     not (it is fresh), and what the number then says is exactly how much of
 *     the directory the door opened. The claim is that it stops growing with
 *     the directory — that it stops being about the directory at all.
 *
 * A tripwire and not a mocked module, unlike `./set.walks.test.ts` next door,
 * because there is no comparator here to wrap: nothing about this cost is a
 * decision the code delegates. It is a walk, and a walk is measured by asking
 * the things it walks over.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import { type Document, isOutline, type Outline, outlineDocument } from "./document.ts"
import { parseOutline } from "./parse.ts"
import { assemble, type OutlineSet, withDocuments } from "./set.ts"
import { following, type Reading, reading } from "./validate.ts"

/** How many times anything asked an outline of the vault for its records. */
interface Tripwire {
  reads: number
}

/**
 * THE SAME SET, with every outline's `nodes` behind a counter.
 *
 * The documents are copies and the RECORDS are not — the arrays and the records
 * in them are the very objects the set was assembled with — so the identity
 * every reader of a view turns on is untouched, and the only thing that moved
 * is that reaching them is observable.
 */
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

/** A directory of outlines, each holding a few records — the shape a served
 *  vault has, at whatever size a case asks for. */
const vault = (files: number): OutlineSet => {
  const decoded = new Map<string, Result.Result<Document, never>>()
  decoded.set("_olai/Trash.olai", Result.succeed(outlineDocument("_olai/Trash.olai", [])))
  for (let which = 0; which < files; which++) {
    const path = `wing/room-${String(which).padStart(4, "0")}.olai`
    const text = [0, 1, 2]
      .map((row) => `{"id":"n${which}-${row}","ord":"a${row}","title":"row ${row}"}`)
      .join("\n")
    const read = parseOutline(path, text)
    if (Result.isFailure(read)) throw new Error(`fixture ${path} does not parse`)
    decoded.set(path, Result.succeed<Document>(read.success))
  }
  return assemble(decoded)
}

/** One file's worth of records, decoded — what a plan becomes on its way into
 *  the set, and the one document below that is NOT behind the tripwire. */
const written = (path: string, title: string): Outline => {
  const id = path.replace(/[^A-Za-z0-9_-]/g, "-")
  const read = parseOutline(path, `{"id":"${id}","ord":"a0","title":"${title}"}`)
  if (Result.isFailure(read)) throw new Error(`${path} does not parse`)
  return read.success
}

/** The door as it stood: the splice, and `reading` with the delta the caller
 *  built beside it — which is where the corpus check lives. */
const checked = (read: Reading, one: Outline): Reading =>
  reading(withDocuments(read.set, [one]), {
    read,
    delta: { upserts: [[one.path, { nodes: one.nodes }]], removes: [] },
  })

/** The two arms over one write, each counted from a reading of its own so that
 *  neither is reading a view the other warmed. */
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
  const read = reading(watched(vault(files), tripwire))
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
    // A file the directory already serves — the common case, and the one an
    // ordinary batch is made of.
    "wing/room-0007.olai",
    // ...one that ARRIVES, which is what an op that archives a node does.
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

  // THE SHAPE OF THE BEFORE COLUMN IS THE COST: the reads grow with the
  // DIRECTORY, per write, for a write that touched one file. Every outline is
  // asked whether it holds anything and then asked again once per record it
  // holds, which is the corpus twice over plus a file count.
  expect(large.checkedReads).toBeGreaterThan(small.checkedReads * 2)
  expect(large.checkedReads).toBeGreaterThan(500 * 3)
  // ...and the door that replaced it opens none of them. Not "fewer": the
  // files this write did not name are not looked inside at all, which is the
  // whole claim — the set carries their documents across by identity and the
  // patcher carries their groupings across by identity, so there is nothing
  // left to establish about them that the reading handed in did not already
  // say.
  expect([small.carriedReads, large.carriedReads]).toEqual([0, 0])
})


test("a write with nothing left to patch onto rebuilds, on either door", () => {
  // The honest other half of the row above: the narrowing carries the untouched
  // files across, so a write with no untouched files carries nothing and both
  // doors spend the same rebuild. A single-outline directory is that case —
  // nothing of the old view is left to patch onto once its one file moves
  // (`./patch.ts`), which is a decline rather than a disagreement, and the fold
  // hits it on every op of a batch against a one-file vault.
  const set = assemble(
    new Map<string, Result.Result<Document, never>>([
      ["only.olai", Result.succeed<Document>(written("only.olai", "the one file"))],
    ]),
  )
  const read = reading(set)
  const one = written("only.olai", "rewritten")
  const carried = following(read, [one])
  const asChecked = checked(read, one)

  // `derive` builds plain maps and only the patcher produces a layer, so this
  // is how the suite says both doors really did rebuild rather than patch.
  expect([carried.derived.byId instanceof Map, asChecked.derived.byId instanceof Map])
    .toEqual([true, true])
  expect(carried.derived.nodes).toEqual(asChecked.derived.nodes)
  expect(carried.derived.byId.get("only-olai")?.node).toMatchObject({ title: "rewritten" })
})
