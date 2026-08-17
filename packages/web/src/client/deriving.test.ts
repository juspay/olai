/**
 * The browser's fold against the same oracle the patcher has.
 *
 * `derive` over the whole corpus is what a view IS
 * (`@olai/format`'s `derive.ts`), and this module's job is to reach that value
 * from the previous one plus what the collection's frames said. So the
 * assertions here are not about what the fold computes — they are that the
 * folded view and the rebuilt one cannot be told apart, and that it really
 * folded rather than quietly rebuilding.
 *
 * What is tested HERE rather than in the format is the seam this slice added:
 * the delta is read back off each entry's `rev`, and the first frame is
 * assembled in the SET's path order rather than the collection's arrival order.
 * Both are client-side facts — the format never sees a `rev`, and the
 * collection's key order is a wire accident — and both are the two ways a
 * browser could hold a different corpus from the one the server judged.
 */

import { expect, test } from "bun:test"
import { derive, type Derived } from "@olai/format"
import { nodesOf, nodesOfFiles } from "@olai/format/testlib"

import { type Entry, viewOf } from "./deriving.ts"

/** A corpus as a fixture writes one: path → the file's JSONL. */
type Corpus = Record<string, string>

/** The collection as a tab holds it: an entry per key, each at the revision it
 *  was last published at. Arrival order is the object's own, deliberately not
 *  path order — a file created while the tab was open arrives last. */
const held = (corpus: Corpus, revs: Record<string, number> = {}): {
  files: ReadonlyArray<string>
  entryOf: (file: string) => Entry | undefined
} => {
  const entries = new Map<string, Entry>(
    Object.entries(corpus).map((
      [file, text],
    ) => [file, { rev: revs[file] ?? 1, nodes: nodesOf(text, file) }]),
  )
  return { files: [...entries.keys()], entryOf: (file) => entries.get(file) }
}

/** What `derive` says about the same corpus — the oracle every assertion below
 *  is against, and it goes through the real ASSEMBLY (`nodesOfFiles` is
 *  `assemble(...).nodes`) rather than a flatten written here. That is the whole
 *  weight of the comparison: a client that came to hold its records in another
 *  order than a validated set does would fail here, where an oracle that sorted
 *  the way this client sorts could only ever agree with it. */
const oracle = (corpus: Corpus): Derived => derive(nodesOfFiles(corpus))

const view = (corpus: Corpus, revs?: Record<string, number>) => {
  const { files, entryOf } = held(corpus, revs)
  return viewOf(undefined, files, entryOf)
}

/**
 * The two views, compared the way the format's own oracle test compares them:
 * whole, and ALL TEN indexes — the flat list, the three that promise a key
 * order, and the six asked one key at a time.
 *
 * Ten rather than the seven this began with, which both reviews of slice 4
 * caught: `children`, `mirrorsOf` and `edgesTo` were the three left out, and
 * they are exactly the three a fold could get wrong without any of the others
 * noticing — a placement filed under the node it no longer shows, an edge left
 * on the key it used to land on, a sibling list merged from two directions in
 * the wrong order. The patcher's own suite compares them, but it does so over
 * deltas IT was handed; what is under test here is the delta this client
 * RECONSTRUCTS, and a comparison that stops at seven cannot tell a wrong delta
 * from a right one in those three.
 *
 * The two `Set`-valued indexes are spread rather than compared as sets, because
 * both promise corpus order to whoever reads them and `toEqual` over a `Set`
 * would only read membership.
 */
const same = (found: Derived, wanted: Derived): void => {
  expect(found.nodes).toEqual(wanted.nodes as never)
  expect([...found.byId]).toEqual([...wanted.byId] as never)
  expect([...found.byFile]).toEqual([...wanted.byFile] as never)
  expect([...found.namedBy]).toEqual([...wanted.namedBy] as never)
  expect([...found.children]).toEqual([...wanted.children] as never)
  expect([...found.status]).toEqual([...wanted.status] as never)
  expect([...found.after]).toEqual([...wanted.after] as never)
  expect([...found.blocked]).toEqual([...wanted.blocked] as never)
  expect(spread(found.mirrorsOf)).toEqual(spread(wanted.mirrorsOf) as never)
  expect(spread(found.edgesTo)).toEqual(spread(wanted.edgesTo) as never)
}

/** A set-valued index as pairs, so the comparison reads its ORDER and not only
 *  which ids are in it. */
const spread = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyArray<readonly [string, ReadonlyArray<string>]> =>
  [...index].map(([id, members]) => [id, [...members]] as const)

const KITCHEN: Corpus = {
  "house.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
  "garden.olai": `{"id":"weed","ord":"a","title":"weed","todo":true}`,
  "wing/kitchen.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
}

test("the first frame is a derivation, in the set's own path order", () => {
  const first = view(KITCHEN)
  same(first.derived, oracle(KITCHEN))
  // ARRIVAL ORDER IS NOT IT: the entries came in the order this fixture names
  // them and the corpus reads in path order, which is what every index keyed by
  // where a record IS depends on.
  expect([...first.derived.byFile.keys()]).toEqual([
    "garden.olai",
    "house.olai",
    "wing/kitchen.olai",
  ])
  expect(first.revs.get("house.olai")).toBe(1)
})

test("a file whose revision moved is the only one folded in", () => {
  const before = view(KITCHEN)
  const edited = `{"id":"cook","ord":"a","title":"cook","done":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`
  const after = { ...KITCHEN, "house.olai": edited }
  const { files, entryOf } = held(after, { "house.olai": 2 })
  const next = viewOf(before, files, entryOf)

  same(next.derived, oracle(after))
  // AND IT REALLY FOLDED. What the edit did not touch is the very array the
  // previous view was holding — a rebuild would have minted a new one, and the
  // assertions above cannot tell the two apart.
  expect(next.derived.byFile.get("garden.olai")).toBe(before.derived.byFile.get("garden.olai"))
  // The mark reached the placement in a file the frame never mentioned.
  expect(next.derived.status.get("m")).toBe("done")
  expect(next.derived.blocked.has("eat")).toBe(false)
  expect(next.revs.get("house.olai")).toBe(2)
})

test("a frame that moved nothing is the view that was already held", () => {
  const before = view(KITCHEN)
  const { files, entryOf } = held(KITCHEN)
  // Same revisions: the collection spoke (a neighbour's document, a reconnect
  // snapshot) and this directory did not.
  expect(viewOf(before, files, entryOf)).toBe(before)
})

test("a file that arrives, and one that goes away", () => {
  const before = view(KITCHEN)
  const arrived: Corpus = {
    ...KITCHEN,
    "attic.olai": `{"id":"boxes","ord":"a","title":"boxes"}`,
  }
  const { files, entryOf } = held(arrived, { "attic.olai": 2 })
  const next = viewOf(before, files, entryOf)
  same(next.derived, oracle(arrived))

  const { "garden.olai": _gone, ...rest } = arrived
  const shrunk = held(rest, { "attic.olai": 2 })
  const last = viewOf(next, shrunk.files, shrunk.entryOf)
  same(last.derived, oracle(rest))
  expect(last.revs.has("garden.olai")).toBe(false)
})

// THE SLICE-4 LANDMINE, from the client's side. `wing.olai` and
// `wing/kitchen.olai` are the one pair of paths a plain string compare and a
// directory walk disagree about, and the patcher places an arriving file by the
// set's order. If this client assembled its first frame in the other one, the
// first frame and every frame after it would be two different corpora — the
// same records, in an order that decided which claim on a duplicate id wins and
// which of two findings a validator reports first.
test("a nested file lands in one place, whichever frame it arrives on", () => {
  const corpus: Corpus = {
    "wing.olai": `{"id":"wing","ord":"a","title":"wing"}`,
    "wing/kitchen.olai": `{"id":"kitchen","ord":"a","title":"kitchen"}`,
    "attic.olai": `{"id":"attic","ord":"a","title":"attic"}`,
  }
  // Every file on the first frame.
  const atOnce = view(corpus)
  expect(atOnce.derived.nodes.map((at) => at.node.id)).toEqual(["attic", "kitchen", "wing"])

  // The same directory reached one file at a time — the nested file created
  // while the tab was open, so it arrives LAST and has to be placed rather than
  // appended.
  const { "wing/kitchen.olai": nested, ...first } = corpus
  const started = view(first)
  const later = held(corpus, { "wing/kitchen.olai": 2 })
  const folded = viewOf(started, later.files, later.entryOf)
  expect(folded.derived.nodes.map((at) => at.node.id)).toEqual(["attic", "kitchen", "wing"])
  same(folded.derived, atOnce.derived)
  expect(nested).toBeDefined()
})

// A FILE THAT HOLDS NOTHING is the case both reviews circled, because it is the
// one a fold could plausibly get wrong: an empty outline and one that did not
// parse contribute no records, so they leave no trace in a view at all, and
// "arrived holding nothing" is indistinguishable from "not here" once the delta
// has been applied. This walks the whole life of one: it arrives beside a
// neighbour's edit, gains records, loses them again, and goes away — with the
// rebuilt view asserted at every step.
test("a file that holds no records comes, fills, empties and goes, and the view says what a rebuild says", () => {
  const start: Corpus = { ...KITCHEN }
  const first = held(start)
  let view = viewOf(undefined, first.files, first.entryOf)
  same(view.derived, oracle(start))

  // ARRIVES, in the same frame as a neighbour's edit and therefore at that
  // frame's revision — the shape the design doc's reviewer named.
  const edited = `{"id":"weed","ord":"a","title":"weed the beds","todo":true}`
  const withEmpty: Corpus = { ...start, "shed.olai": "", "garden.olai": edited }
  const arriving = held(withEmpty, { "shed.olai": 2, "garden.olai": 2 })
  view = viewOf(view, arriving.files, arriving.entryOf)
  same(view.derived, oracle(withEmpty))
  expect(view.derived.byFile.has("shed.olai")).toBe(false)
  expect(view.revs.get("shed.olai")).toBe(2)

  // FILLS: the file the view kept no trace of gains a record.
  const filled: Corpus = { ...withEmpty, "shed.olai": `{"id":"rake","ord":"a","title":"rake"}` }
  const filling = held(filled, { "shed.olai": 3, "garden.olai": 2 })
  view = viewOf(view, filling.files, filling.entryOf)
  same(view.derived, oracle(filled))

  // EMPTIES again — which is also what a file that stopped parsing looks like
  // from here, since a broken entry carries no nodes.
  const emptied: Corpus = { ...filled, "shed.olai": "" }
  const emptying = held(emptied, { "shed.olai": 4, "garden.olai": 2 })
  view = viewOf(view, emptying.files, emptying.entryOf)
  same(view.derived, oracle(emptied))

  // AND GOES. A remove of a file the view never held records for is a no-op on
  // every index, and the revisions stop naming it.
  const { "shed.olai": _gone, ...without } = emptied
  const leaving = held(without, { "garden.olai": 2 })
  view = viewOf(view, leaving.files, leaving.entryOf)
  same(view.derived, oracle(without))
  expect(view.revs.has("shed.olai")).toBe(false)
})
