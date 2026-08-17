/**
 * The patcher against its oracle.
 *
 * `derive` IS the specification of what a view is, so this suite does not
 * assert what the patcher computes — it asserts that the patcher and the
 * rebuild cannot be told apart. Generated corpora, generated deltas, both views
 * built, compared whole:
 *
 *     patch(derive(before), delta) === derive(after)
 *
 * The generator writes the awkward sets on purpose — duplicate ids, mirrors of
 * mirrors, chains that dangle, edges that name a placement, `ord` ties across
 * files, an `Archive.olai` — because those are exactly the corners where an
 * incremental index and a rebuilt one can quietly disagree, and because
 * `derive` itself is written to answer over sets the validator has condemned.
 *
 * WHAT "the same" MEANS here is a decision, and it is made in {@link readable}
 * rather than left to a deep-equality helper: three of the ten indexes promise
 * an ORDER their keys are read in, and the rest are asked one key at a time.
 * Comparing all ten by key order would hold the patcher to a promise no reader
 * spends; comparing none of them would let it silently reorder the two that a
 * reader does.
 *
 * AND IT MUST REALLY PATCH. A patcher that declined every time would satisfy
 * every assertion above and buy nothing, so {@link patched} — the incremental
 * answer with the fallback taken off — is what the property test calls, and a
 * decline is counted rather than tolerated.
 */

import { expect, test } from "bun:test"

import { derive, type Derived } from "./derive.ts"
import { FIXTURE_FILE, nodesOf, setOf } from "./fixtures.testlib.ts"
import { patch, patched, type SetDelta } from "./patch.ts"

/** A corpus as a fixture writes one: path → the file's JSONL. */
type Corpus = Record<string, string>

const viewOf = (corpus: Corpus): Derived => derive(setOf(corpus).nodes)

/** What moved between two corpora, in the frame the wire already speaks: a
 *  file whose text changed is an upsert, a file that went away is a remove. */
const deltaOf = (before: Corpus, after: Corpus): SetDelta => ({
  upserts: Object.entries(after)
    .filter(([file, text]) => before[file] !== text)
    .map(([file, text]) => [file, { nodes: nodesOf(text, file) }] as const),
  removes: Object.keys(before).filter((file) => !(file in after)),
})

/**
 * A whole view, in the shape the comparison is about.
 *
 * KEY ORDER IS KEPT for the three indexes something reads in order:
 * `byId`, because the did-you-mean behind every unknown-target error walks its
 * keys; `namedBy`, because the validator walks it to report ids nothing
 * declares, and two findings at one site come out in the order the corpus first
 * named them; `byFile`, because the flat list of records IS that map read in
 * order, so a key in the wrong place is a corpus in the wrong order.
 *
 * The other seven are asked one key at a time — `derived.children.get(id)`,
 * `derived.status.get(id)` — and are sorted here so the comparison is about
 * what they ANSWER. Their values are compared in order all the same, including
 * the two that are sets: `mirrorsOf` and `edgesTo` promise corpus order to
 * whoever spreads them, and `toEqual` over a `Set` would only read membership.
 */
const readable = (derived: Derived): unknown => ({
  nodes: derived.nodes,
  byId: [...derived.byId],
  byFile: [...derived.byFile],
  namedBy: [...derived.namedBy],
  children: byKey(derived.children),
  status: byKey(derived.status),
  after: byKey(derived.after),
  blocked: byKey(derived.blocked),
  mirrorsOf: byKey(spread(derived.mirrorsOf)),
  edgesTo: byKey(spread(derived.edgesTo)),
})

const byKey = <V>(map: ReadonlyMap<string, V>): ReadonlyArray<readonly [string, V]> =>
  [...map].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))

const spread = (
  index: ReadonlyMap<string, ReadonlySet<string>>,
): ReadonlyMap<string, ReadonlyArray<string>> =>
  new Map([...index].map(([id, members]) => [id, [...members]]))

/** The two views, compared — and, when they differ, the corpus that did it,
 *  because a property test that says only "not equal" over generated input is
 *  a test nobody can act on. */
const same = (found: Derived, oracle: Derived, story: () => string): void => {
  try {
    expect(readable(found)).toEqual(readable(oracle) as never)
  } catch (cause) {
    throw new Error(`${cause instanceof Error ? cause.message : String(cause)}\n\n${story()}`)
  }
}

// ── the property ───────────────────────────────────────────────────────

/** Mulberry32: eight lines of arithmetic and one seed, so a failure is a case
 *  that can be re-run rather than a case that happened once on somebody's
 *  machine. `Math.random` would make this suite a lottery whose losing tickets
 *  are unprintable. */
const source = (seed: number): (() => number) => {
  let at = seed >>> 0
  return () => {
    at = (at + 0x6D2B79F5) | 0
    let mixed = Math.imul(at ^ (at >>> 15), 1 | at)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(random: () => number, from: ReadonlyArray<T>): T =>
  from[Math.floor(random() * from.length)] as T

/** Four paths, and each of them says something: two plain outlines, one in a
 *  directory (so path order is not file-name order), and the archive, whose
 *  records are exempt from blockedness at both ends of an arrow. */
const FILES = ["a.olai", "b.olai", "deep/c.olai", "Archive.olai"] as const
/** The names records are drawn from — small enough that a target often names a
 *  record that is really there, and often one that is not. */
const IDS = Array.from({ length: 24 }, (_, at) => `n${at}`)
/** Three of them, so siblings tie on `ord` and the tie-break gets exercised. */
const ORDS = ["a", "b", "c"] as const

/**
 * An id for the next record: a fresh one nearly always, one already claimed
 * now and then.
 *
 * Deliberately not uniform. Drawing ids uniformly from a pool makes a duplicate
 * the RULE at these corpus sizes, and a duplicate is the one corner the patcher
 * hands straight back to the rebuild — so a uniform generator would have
 * measured the fallback five hundred times and the patcher hardly at all. This
 * writes the corpora a directory actually holds, with the corner still turning
 * up often enough to be tested.
 */
const idFor = (random: () => number, used: Set<string>): string => {
  const free = IDS.filter((id) => !used.has(id))
  const id = random() < 0.08 || free.length === 0
    ? pick(random, [...used, ...free])
    : pick(random, free)
  used.add(id)
  return id
}

const fileOf = (random: () => number, used: Set<string>): string => {
  const lines: Array<string> = []
  const own: Array<string> = []
  const many = Math.floor(random() * 5)
  for (let at = 0; at < many; at++) {
    const id = idFor(random, used)
    const record: Record<string, unknown> = { id, ord: pick(random, ORDS) }
    if (own.length > 0 && random() < 0.4) record["parent"] = pick(random, own)
    if (random() < 0.25) record["mirror"] = pick(random, IDS)
    else {
      record["title"] = `line ${at}`
      if (random() < 0.4) record[pick(random, ["done", "doing", "todo"])] = true
      if (random() < 0.3) record["after"] = [pick(random, IDS)]
      if (random() < 0.3) record["blocks"] = [pick(random, IDS)]
      if (random() < 0.2) record["see"] = [pick(random, IDS)]
    }
    own.push(id)
    lines.push(JSON.stringify(record))
  }
  return lines.join("\n")
}

/** A corpus, and the ids it has spent — the delta below draws from the same
 *  pool, so a rewritten file goes on naming records its neighbours hold. */
const corpusOf = (random: () => number): { files: Corpus; used: Set<string> } => {
  const files: Corpus = {}
  const used = new Set<string>()
  // A file the directory does not hold at all, so a delta can bring one in and
  // the flat list has to find its place in path order.
  for (const file of FILES) if (random() < 0.75) files[file] = fileOf(random, used)
  return { files, used }
}

/**
 * One file, edited the way a person edits one: the same records, one of them
 * changed. This is the delta the patcher is FOR — a keystroke, a mark, an edge
 * — and a generator that only ever replaced whole files would have tested the
 * arriving-corpus path over and over and the keystroke path never.
 */
const tweak = (random: () => number, text: string): string => {
  const lines = text.split("\n").filter((line) => line !== "")
  if (lines.length === 0) return text
  const at = Math.floor(random() * lines.length)
  const record = JSON.parse(lines[at] as string) as Record<string, unknown>
  const roll = random()
  if ("mirror" in record) record["mirror"] = pick(random, IDS)
  else if (roll < 0.3) record["title"] = `edited ${Math.floor(random() * 100)}`
  else if (roll < 0.55) {
    for (const mark of ["done", "doing", "todo"]) delete record[mark]
    if (random() < 0.75) record[pick(random, ["done", "doing", "todo"])] = true
  } else if (roll < 0.75) {
    if (random() < 0.5) record["after"] = [pick(random, IDS)]
    else delete record["after"]
  } else if (roll < 0.9) {
    if (random() < 0.5) record["blocks"] = [pick(random, IDS)]
    else delete record["blocks"]
  } else {
    // The record goes away, which is the delete a patcher has to answer for:
    // an id leaves the corpus and whatever named it is left naming nothing.
    lines.splice(at, 1)
    return lines.join("\n")
  }
  lines[at] = JSON.stringify(record)
  return lines.join("\n")
}

const editOf = (
  random: () => number,
  before: Corpus,
  used: Set<string>,
): Corpus => {
  const after = { ...before }
  const many = 1 + Math.floor(random() * 2)
  for (let at = 0; at < many; at++) {
    const file = pick(random, FILES)
    const held = after[file]
    const roll = random()
    if (roll < 0.1) delete after[file]
    else if (roll < 0.35 || held === undefined) after[file] = fileOf(random, used)
    else after[file] = tweak(random, held)
  }
  return after
}

const ROUNDS = 500

test("the patched view is the derived view, for any corpus and any delta", () => {
  const random = source(20260816)
  let declined = 0
  for (let round = 0; round < ROUNDS; round++) {
    const { files: before, used } = corpusOf(random)
    const after = editOf(random, before, used)
    const delta = deltaOf(before, after)
    const view = viewOf(before)
    const oracle = viewOf(after)
    const story = () =>
      `round ${round}\nbefore: ${JSON.stringify(before, null, 2)}\n` +
      `after: ${JSON.stringify(after, null, 2)}`

    const incremental = patched(view, delta)
    if (incremental === undefined) declined++
    else same(incremental, oracle, story)
    // The total function answers the same thing whichever way it got there.
    same(patch(view, delta), oracle, story)
    // A REVISION IS ATOMIC: the view handed in is the view it was, still, with
    // nothing of the patch showing through a shared map, array or set.
    same(view, viewOf(before), story)
  }
  // Not a performance assertion — a claim that the assertions above are about
  // the patcher at all. Left unchecked, a patcher that declined everything
  // would pass this whole file.
  expect(declined).toBeLessThan(ROUNDS / 4)
})

// ── what the reverse indexes are for ───────────────────────────────────

const KITCHEN: Corpus = {
  "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`,
  "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
  "deep/c.olai": `{"id":"m2","ord":"a","mirror":"m"}`,
}

/** The delta one file's new text makes — the shape a probe tick produces for a
 *  single edited outline. */
const editing = (file: string, text: string): SetDelta => ({
  upserts: [[file, { nodes: nodesOf(text, file) }]],
  removes: [],
})

test("a mark flips, and the placements standing for it two files away say so", () => {
  const view = viewOf(KITCHEN)
  const done = `{"id":"cook","ord":"a","title":"cook","done":true}\n` +
    `{"id":"eat","ord":"b","title":"eat","after":["cook"]}`
  const next = patched(view, editing("a.olai", done))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...KITCHEN, "a.olai": done }), () => "mark flip")
  // The whole point of the walk: a mirror OF A MIRROR, in a file the delta
  // never named, shows the mark that moved.
  expect((next as Derived).status.get("m2")).toBe("done")
  // And what was waiting on it is no longer waiting — the reverse edge index
  // read as "who has to be looked at again".
  expect((next as Derived).blocked.has("eat")).toBe(false)
})

test("an edit keeps the files it did not touch, entry by entry", () => {
  const view = viewOf(KITCHEN)
  const next = patch(view, editing("a.olai", `{"id":"cook","ord":"a","title":"cook again"}`))
  // Not equality — IDENTITY. What a patch does not touch is the very array the
  // previous view was holding, which is what makes patching worth doing at all.
  expect(next.byFile.get("b.olai")).toBe(view.byFile.get("b.olai"))
  expect(next.byId.get("m")).toBe(view.byId.get("m"))
})

test("a mirror chain that dangled resolves the moment its target arrives", () => {
  // `mirrorsOf` files a chain under the node it ENDS at, and this one ends
  // nowhere — so nothing but the raw index can find these two placements when
  // `far` turns up.
  const before: Corpus = {
    "a.olai": `{"id":"here","ord":"a","title":"here"}`,
    "b.olai": `{"id":"one","ord":"a","mirror":"two"}\n{"id":"two","ord":"b","mirror":"far"}`,
  }
  const view = viewOf(before)
  expect(view.status.has("one")).toBe(false)
  const arrived = `{"id":"here","ord":"a","title":"here"}\n{"id":"far","ord":"b","title":"far","doing":true}`
  const next = patched(view, editing("a.olai", arrived))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "a.olai": arrived }), () => "a target arrives")
  expect((next as Derived).status.get("one")).toBe("doing")
  expect([...((next as Derived).mirrorsOf.get("far") ?? [])]).toEqual(["one", "two"])
})

test("an edge written at a placement moves with the placement", () => {
  // `wait after m`, where `m` mirrors `cook`, is an edge to COOK — so pointing
  // the placement somewhere else re-points an edge in a file nothing touched.
  const before: Corpus = {
    "a.olai": `{"id":"cook","ord":"a","title":"cook","todo":true}\n` +
      `{"id":"wash","ord":"b","title":"wash","todo":true}`,
    "b.olai": `{"id":"m","ord":"a","mirror":"cook"}`,
    "deep/c.olai": `{"id":"wait","ord":"a","title":"wait","todo":true,"after":["m"]}`,
  }
  const view = viewOf(before)
  expect(view.after.get("wait")).toEqual(["cook"])
  const moved = `{"id":"m","ord":"a","mirror":"wash"}`
  const next = patched(view, editing("b.olai", moved))
  expect(next).toBeDefined()
  same(next as Derived, viewOf({ ...before, "b.olai": moved }), () => "a placement moves")
  expect((next as Derived).after.get("wait")).toEqual(["wash"])
  expect([...((next as Derived).edgesTo.get("wash") ?? [])]).toEqual(["wait"])
})

// ── files coming and going ─────────────────────────────────────────────

test("a file that arrives takes its place in path order", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one"}`,
    "z.olai": `{"id":"three","ord":"a","title":"three"}`,
  }
  const view = viewOf(before)
  const added = { ...before, "b.olai": `{"id":"two","ord":"a","title":"two"}` }
  const next = patch(view, editing("b.olai", added["b.olai"] as string))
  same(next, viewOf(added), () => "a file arrives")
  expect(next.nodes.map((at) => at.node.id)).toEqual(["one", "two", "three"])
})

test("a file that goes away takes its records with it", () => {
  const before: Corpus = {
    "a.olai": `{"id":"one","ord":"a","title":"one","todo":true,"after":["two"]}`,
    "b.olai": `{"id":"two","ord":"a","title":"two","todo":true}`,
    "deep/c.olai": `{"id":"three","ord":"a","mirror":"two"}`,
  }
  const view = viewOf(before)
  expect(view.blocked.has("one")).toBe(true)
  const { "b.olai": _gone, ...after } = before
  const next = patch(view, { upserts: [], removes: ["b.olai"] })
  same(next, viewOf(after), () => "a file leaves")
  // The edge is still written, so it is still in the graph — as the id it
  // names, which nothing declares now. What changes is that nothing is in the
  // way, because a target that is not there is not a task that is not done.
  expect(next.after.get("one")).toEqual(["two"])
  expect(next.blocked.has("one")).toBe(false)
  expect(next.status.has("three")).toBe(false)
})

test("an empty delta is the same view, and says so by being it", () => {
  const view = viewOf(KITCHEN)
  expect(patch(view, { upserts: [], removes: [] })).toBe(view)
})

// ── where it declines ──────────────────────────────────────────────────

test("a duplicate id is handed back to the rebuild, and answered anyway", () => {
  const before: Corpus = {
    "a.olai": `{"id":"x","ord":"a","title":"first"}`,
    "b.olai": `{"id":"y","ord":"a","title":"second"}`,
    "deep/c.olai": `{"id":"z","ord":"a","title":"third"}`,
  }
  const view = viewOf(before)
  // A second claim on an id a file the delta never named already holds: the
  // patcher would have to know which record loses, and losers are what this
  // index does not keep.
  const clash = `{"id":"x","ord":"a","title":"clash"}`
  expect(patched(view, editing("b.olai", clash))).toBeUndefined()
  same(patch(view, editing("b.olai", clash)), viewOf({ ...before, "b.olai": clash }), () => "clash")

  // And once the corpus HOLDS a duplicate, no patch is attempted onto it: the
  // first claim is a fact about corpus order, and promoting the next one is
  // exactly what an index without the losers cannot do.
  const clashed = viewOf({ ...before, "b.olai": clash })
  expect(patched(clashed, editing("deep/c.olai", `{"id":"z","ord":"a","title":"other"}`)))
    .toBeUndefined()
})

test("a delta that leaves nothing standing is a rebuild", () => {
  const before: Corpus = { [FIXTURE_FILE]: `{"id":"one","ord":"a","title":"one"}` }
  const view = viewOf(before)
  const text = `{"id":"one","ord":"a","title":"two"}`
  expect(patched(view, editing(FIXTURE_FILE, text))).toBeUndefined()
  same(patch(view, editing(FIXTURE_FILE, text)), viewOf({ [FIXTURE_FILE]: text }), () => "one file")
})
